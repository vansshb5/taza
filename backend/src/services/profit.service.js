/**
 * Profit Service
 *
 * Orchestrates profit/loss calculations for a batch across all available markets.
 * Combines: batch data + prediction + market prices + cost data
 * → structured P&L per destination
 */

import ProfitAnalysis from "../models/ProfitAnalysis.js";
import { getBatchById } from "./batch.service.js";
import { getPreferredPrediction } from "./prediction.service.js";
import { getMarketPrices, computeMarketOpportunities } from "./market.service.js";
import { computeExpectedProfitLoss } from "../utils/calculations.js";
import { getDaysSinceDate } from "./shelfLife.service.js";
import logger from "../utils/logger.js";

/**
 * Run a full profit/loss analysis for a batch.
 *
 * @param {string} batchId
 * @param {object} overrides  Optional cost overrides: { procurementCostPerKg, storageCostPerKgPerDay }
 * @param {object} transportConfig  Optional transport config per location
 * @returns {ProfitAnalysis} Persisted analysis document
 */
export const runProfitAnalysis = async (batchId, overrides = {}, transportConfig = {}) => {
    const batch = await getBatchById(batchId);
    if (!batch) throw Object.assign(new Error("Batch not found"), { statusCode: 404 });

    const prediction = await getPreferredPrediction(batchId);
    if (!prediction)
        throw Object.assign(
            new Error("No prediction found. Run POST /api/predictions/:batchId/run first."),
            { statusCode: 404 }
        );

    const marketPrices = await getMarketPrices(batch.produceType);
    if (marketPrices.length === 0)
        throw Object.assign(
            new Error(`No market price data for '${batch.produceType}'.`),
            { statusCode: 404 }
        );

    // Resolve cost inputs (use overrides > batch stored values > null)
    const procurementCostPerKg =
        overrides.procurementCostPerKg ?? batch.procurementCostPerKg ?? null;
    const storageCostPerKgPerDay =
        overrides.storageCostPerKgPerDay ?? batch.storageCostPerKgPerDay ?? null;

    // Days since arrival — approximate storage duration
    const storageDaysRemaining = batch.arrivalDate
        ? getDaysSinceDate(batch.arrivalDate)
        : 0;

    // First compute market opportunities (includes transport spoilage)
    const opportunities = computeMarketOpportunities(
        batch,
        {
            freshnessScore: prediction.freshnessScore,
            shelfLifeDays: prediction.shelfLifeDays,
            spoilageProbability: prediction.spoilageProbability,
        },
        marketPrices,
        transportConfig
    );

    // Now compute full P&L for each opportunity
    const allMissingInputs = new Set();
    const marketAnalysis = opportunities.map((opp) => {
        const pl = computeExpectedProfitLoss({
            quantity: batch.quantity,
            pricePerKg: opp.pricePerKg,
            transportCostTotal: opp.transportCostTotal ?? 0,
            spoilageFraction: opp.expectedSpoilageFraction,
            procurementCostPerKg,
            storageCostPerKgPerDay,
            storageDaysRemaining,
        });

        pl.missingInputs.forEach((mi) => allMissingInputs.add(mi));

        return {
            market: opp.market,
            location: opp.location,
            pricePerKg: opp.pricePerKg,
            transportCostPerKg: opp.transportCostPerKg,
            transportCostTotal: opp.transportCostTotal,
            expectedSpoilageFraction: opp.expectedSpoilageFraction,
            expectedSpoilagePercent: opp.expectedSpoilagePercent,
            sellableQuantity: pl.sellableQuantity,
            spoiledQuantity: pl.spoiledQuantity,
            grossRevenue: pl.grossRevenue,
            procurementCost: pl.procurementCost,
            storageCost: pl.storageCost,
            spoilageLoss: pl.spoilageLoss,
            expectedProfit: pl.expectedProfit,
            profitPerKg: pl.profitPerKg,
            wastePercent: pl.wastePercent,
            risk: opp.risk,
            isFeasible: opp.isFeasible,
            isPartialCalculation: pl.isPartialCalculation,
            missingInputs: pl.missingInputs,
        };
    });

    // Identify best market (highest expected profit, or highest revenue if no costs)
    const feasible = marketAnalysis.filter((m) => m.isFeasible !== false);
    let bestMarket = null;
    let bestExpectedProfit = null;

    if (feasible.length > 0) {
        const withProfit = feasible.filter((m) => m.expectedProfit !== null);
        if (withProfit.length > 0) {
            const best = withProfit.reduce((a, b) =>
                a.expectedProfit > b.expectedProfit ? a : b
            );
            bestMarket = best.market;
            bestExpectedProfit = best.expectedProfit;
        } else {
            // Fall back to highest revenue
            const best = feasible.reduce((a, b) =>
                a.grossRevenue > b.grossRevenue ? a : b
            );
            bestMarket = best.market;
        }
    }

    const analysis = await ProfitAnalysis.create({
        batchId,
        predictionId: prediction._id,
        inputSnapshot: {
            quantity: batch.quantity,
            produceType: batch.produceType,
            freshnessScore: prediction.freshnessScore,
            shelfLifeDays: prediction.shelfLifeDays,
            spoilageProbability: prediction.spoilageProbability,
            procurementCostPerKg,
        },
        marketAnalysis,
        bestMarket,
        bestExpectedProfit,
        missingCostInputs: [...allMissingInputs],
    });

    logger.info("Profit analysis completed", {
        batchId,
        bestMarket,
        marketsAnalysed: marketAnalysis.length,
        missingInputs: [...allMissingInputs],
    });

    return analysis;
};

/**
 * Get the latest profit analysis for a batch.
 */
export const getLatestProfitAnalysis = async (batchId) => {
    return ProfitAnalysis.findOne({ batchId }).sort({ createdAt: -1 });
};

/**
 * Get profit analysis history.
 */
export const getProfitAnalysisHistory = async (batchId, limit = 5) => {
    return ProfitAnalysis.find({ batchId }).sort({ createdAt: -1 }).limit(limit);
};
