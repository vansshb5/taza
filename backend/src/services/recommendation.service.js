/**
 * Recommendation Service — Decision Engine
 *
 * Synthesises: prediction + profit analysis + batch state
 * → an actionable recommendation with an explanation.
 *
 * Decision logic is:
 * 1. CRITICAL shelf life (≤ 0.5 days) → URGENT_SELL
 * 2. HIGH spoilage risk (≥ 0.7) → DISCOUNT or REDIRECT
 * 3. Profitable market opportunity (significantly better than local) → MOVE_TO_MARKET
 * 4. Shelf life is comfortable + no better market → HOLD
 * 5. Low shelf life (≤ 1.5 days) with local demand → SELL_LOCAL
 * 6. Everything else → SELL_LOCAL or HOLD based on freshness
 *
 * This logic is modular — each rule is a separate function so it's easy
 * to extend or adjust thresholds.
 */

import Recommendation from "../models/Recommendation.js";
import { getBatchById } from "./batch.service.js";
import { getLatestPrediction } from "./prediction.service.js";
import { getLatestProfitAnalysis } from "./profit.service.js";
import logger from "../utils/logger.js";

// ── Decision Thresholds ─────────────────────────────────────────────────────
// These are clearly labelled constants — easy to tune.
const THRESHOLDS = {
    CRITICAL_SHELF_LIFE_DAYS: 0.5,   // < 0.5 days → URGENT_SELL
    LOW_SHELF_LIFE_DAYS: 1.5,         // < 1.5 days → SELL_LOCAL
    HIGH_SPOILAGE_RISK: 0.7,          // ≥ 0.7 → DISCOUNT / REDIRECT
    MEDIUM_SPOILAGE_RISK: 0.45,       // ≥ 0.45 → consider action
    PROFITABLE_MOVE_THRESHOLD: 1.1,   // 10%+ better profit to justify moving
    COMFORTABLE_SHELF_LIFE_DAYS: 4,   // > 4 days → HOLD may be appropriate
};

// ── Helper functions ─────────────────────────────────────────────────────────

const findLocalMarket = (marketAnalysis, batch) => {
    if (!marketAnalysis || marketAnalysis.length === 0) return null;
    return (
        marketAnalysis.find(
            (m) =>
                (m.transportCostTotal || 0) === 0 ||
                m.transportCostPerKg === 0 ||
                (batch?.currentLocation && m.location && m.location.toLowerCase() === batch.currentLocation.toLowerCase())
        ) || marketAnalysis[0]
    );
};

// ── Rule functions ────────────────────────────────────────────────────────────

const ruleUrgentSell = (prediction) => {
    if (prediction.shelfLifeDays <= THRESHOLDS.CRITICAL_SHELF_LIFE_DAYS) {
        return {
            actionType: "URGENT_SELL",
            urgencyLevel: "CRITICAL",
            reason: `Estimated shelf life is critically low (${prediction.shelfLifeDays} days). Sell immediately at any available price to minimise total loss.`,
        };
    }
    return null;
};

const ruleDiscount = (prediction) => {
    if (
        prediction.spoilageProbability >= THRESHOLDS.HIGH_SPOILAGE_RISK &&
        prediction.shelfLifeDays <= THRESHOLDS.LOW_SHELF_LIFE_DAYS
    ) {
        return {
            actionType: "DISCOUNT",
            urgencyLevel: "HIGH",
            reason: `High spoilage risk (${Math.round(prediction.spoilageProbability * 100)}%) with only ${prediction.shelfLifeDays} days remaining. A discounted sale now is likely to recover more value than waiting.`,
        };
    }
    return null;
};

const ruleMoveToMarket = (prediction, profitAnalysis, batch) => {
    if (!profitAnalysis) return null;

    const { marketAnalysis, bestMarket } = profitAnalysis;
    if (!bestMarket || !marketAnalysis || marketAnalysis.length < 2) return null;

    // Need at least 2 feasible markets to compare
    const feasibleMarkets = marketAnalysis.filter(
        (m) => m.isFeasible !== false && m.expectedProfit !== null
    );
    if (feasibleMarkets.length < 2) return null;

    // Sort by profit descending
    feasibleMarkets.sort((a, b) => b.expectedProfit - a.expectedProfit);
    const best = feasibleMarkets[0];
    const secondBest = feasibleMarkets[1];

    // Only recommend a move if the profit improvement is meaningful
    let isProfitableMove = false;
    if (secondBest.expectedProfit > 0) {
        const improvementRatio = best.expectedProfit / secondBest.expectedProfit;
        isProfitableMove = improvementRatio >= THRESHOLDS.PROFITABLE_MOVE_THRESHOLD;
    } else {
        // If secondBest is zero or negative, any positive profit is clearly better
        isProfitableMove = best.expectedProfit > secondBest.expectedProfit && best.expectedProfit > 0;
    }

    if (
        isProfitableMove &&
        prediction.shelfLifeDays > 1 // enough shelf life to make the journey
    ) {
        return {
            actionType: "MOVE_TO_MARKET",
            targetMarket: best.market,
            targetLocation: best.location,
            urgencyLevel: prediction.shelfLifeDays < 2 ? "HIGH" : "MEDIUM",
            reason: `Moving to ${best.market} (${best.location}) offers an estimated ₹${best.expectedProfit?.toLocaleString("en-IN")} profit — significantly better than the next best option (₹${secondBest.expectedProfit?.toLocaleString("en-IN")} at ${secondBest.market}). Transport time is within estimated shelf life.`,
            expectedProfit: best.expectedProfit,
            expectedRevenue: best.grossRevenue,
            expectedWastePercent: best.wastePercent,
        };
    }
    return null;
};

const ruleSellLocal = (prediction, profitAnalysis, batch) => {
    if (prediction.shelfLifeDays <= THRESHOLDS.LOW_SHELF_LIFE_DAYS) {
        const localMarket = findLocalMarket(profitAnalysis?.marketAnalysis, batch);
        return {
            actionType: "SELL_LOCAL",
            urgencyLevel: prediction.shelfLifeDays < 1 ? "HIGH" : "MEDIUM",
            reason: `With ${prediction.shelfLifeDays} days of estimated shelf life remaining, selling locally minimises transport risk and recovery time. Transporting to a distant market risks arriving with unacceptable spoilage.`,
            expectedRevenue: localMarket?.grossRevenue ?? null,
            expectedProfit: localMarket?.expectedProfit ?? null,
            expectedWastePercent: localMarket?.wastePercent ?? null,
        };
    }
    return null;
};

const ruleHold = (prediction) => {
    if (
        prediction.shelfLifeDays > THRESHOLDS.COMFORTABLE_SHELF_LIFE_DAYS &&
        prediction.spoilageProbability < 0.2
    ) {
        return {
            actionType: "HOLD",
            urgencyLevel: "LOW",
            reason: `Freshness is good (score: ${prediction.freshnessScore}/100) with ${prediction.shelfLifeDays} days of estimated shelf life and low spoilage risk (${Math.round(prediction.spoilageProbability * 100)}%). No immediate action required — monitor conditions.`,
        };
    }
    return null;
};

const ruleDefaultSellLocal = (prediction, profitAnalysis, batch) => {
    const localMarket = findLocalMarket(profitAnalysis?.marketAnalysis, batch);
    return {
        actionType: "SELL_LOCAL",
        urgencyLevel: prediction.spoilageProbability >= THRESHOLDS.MEDIUM_SPOILAGE_RISK ? "MEDIUM" : "LOW",
        reason: `Based on current freshness (score: ${prediction.freshnessScore}/100), spoilage risk (${Math.round(prediction.spoilageProbability * 100)}%), and ${prediction.shelfLifeDays} days of estimated shelf life, selling locally is the most reliable option.`,
        expectedRevenue: localMarket?.grossRevenue ?? null,
        expectedProfit: localMarket?.expectedProfit ?? null,
    };
};

// ── Main Engine ───────────────────────────────────────────────────────────────

/**
 * Generate a recommendation for a batch.
 * Evaluates rules in priority order; first matching rule wins.
 */
export const generateRecommendation = async (batchId) => {
    const batch = await getBatchById(batchId);
    if (!batch) throw Object.assign(new Error("Batch not found"), { statusCode: 404 });

    const prediction = await getLatestPrediction(batchId);
    if (!prediction)
        throw Object.assign(
            new Error("No prediction found. Run POST /api/predictions/:batchId/run first."),
            { statusCode: 404 }
        );

    const profitAnalysis = await getLatestProfitAnalysis(batchId);
    // profitAnalysis may be null — the engine handles that gracefully

    // Evaluate rules in priority order
    const decision =
        ruleUrgentSell(prediction) ||
        ruleDiscount(prediction) ||
        ruleMoveToMarket(prediction, profitAnalysis, batch) ||
        ruleSellLocal(prediction, profitAnalysis, batch) ||
        ruleHold(prediction) ||
        ruleDefaultSellLocal(prediction, profitAnalysis, batch);

    const recommendation = await Recommendation.create({
        batchId,
        predictionId: prediction._id,
        profitAnalysisId: profitAnalysis?._id || null,
        actionType: decision.actionType,
        targetMarket: decision.targetMarket || null,
        targetLocation: decision.targetLocation || null,
        urgencyLevel: decision.urgencyLevel,
        reason: decision.reason,
        reasonFactors: {
            shelfLifeDays: prediction.shelfLifeDays,
            spoilageProbability: prediction.spoilageProbability,
            freshnessScore: prediction.freshnessScore,
            bestMarket: profitAnalysis?.bestMarket || null,
            expectedProfit: decision.expectedProfit ?? null,
            riskLevel: prediction.riskLevel,
        },
        expectedRevenue: decision.expectedRevenue ?? null,
        expectedProfit: decision.expectedProfit ?? null,
        expectedWastePercent: decision.expectedWastePercent ?? null,
        expectedWasteKg:
            decision.expectedWastePercent !== null && decision.expectedWastePercent !== undefined
                ? Math.round((decision.expectedWastePercent / 100) * batch.quantity * 10) / 10
                : null,
        confidence: prediction.confidence,
    });

    logger.info("Recommendation generated", {
        batchId,
        actionType: decision.actionType,
        urgencyLevel: decision.urgencyLevel,
        targetMarket: decision.targetMarket,
    });

    return recommendation;
};

/**
 * Get the latest recommendation for a batch.
 */
export const getLatestRecommendation = async (batchId) => {
    return Recommendation.findOne({ batchId })
        .sort({ createdAt: -1 })
        .populate("predictionId", "freshnessScore shelfLifeDays spoilageProbability riskLevel");
};

/**
 * Get recommendation history.
 */
export const getRecommendationHistory = async (batchId, limit = 10) => {
    return Recommendation.find({ batchId })
        .sort({ createdAt: -1 })
        .limit(limit);
};

/**
 * Get all latest recommendations across batches.
 */
export const getAllRecommendations = async (limit = 50) => {
    return Recommendation.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("batchId", "batchCode produceType quantity stage status currentLocation")
        .populate("predictionId", "freshnessScore shelfLifeDays spoilageProbability riskLevel");
};
