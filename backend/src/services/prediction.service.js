/**
 * Prediction Service — ML Adapter Layer
 *
 * This is the orchestration layer that:
 * 1. Loads batch + latest inspection
 * 2. Runs freshness / shelf-life / spoilage calculations
 * 3. Persists the result as a Prediction document
 * 4. Updates the Batch prediction cache
 *
 * IMPORTANT: The `source` field in the Prediction document is set to
 * "heuristic_mock" while the Python ML service is not yet integrated.
 *
 * When the Python ML service is ready:
 * - Replace the computeXxx() calls with a call to mlProxyService.predict()
 * - Change source to "ml_python_service"
 * - Everything else stays the same
 */

import Prediction from "../models/Prediction.js";
import { getBatchById, updateBatchPredictionCache } from "./batch.service.js";
import { getLatestInspectionForBatch } from "./qualityInspection.service.js";
import { buildFreshnessSignals, computeBatchFreshnessScore } from "./freshness.service.js";
import { computeBatchShelfLife } from "./shelfLife.service.js";
import { computeBatchSpoilage } from "./spoilage.service.js";
import logger from "../utils/logger.js";

/**
 * Run a full prediction for a batch and persist the result.
 *
 * @param {string} batchId
 * @returns {object} The persisted Prediction document
 */
export const runBatchPrediction = async (batchId) => {
    const batch = await getBatchById(batchId);
    if (!batch) throw Object.assign(new Error("Batch not found"), { statusCode: 404 });

    const inspection = await getLatestInspectionForBatch(batchId);

    // --- Compute all signals ---
    const signals = buildFreshnessSignals(batch, inspection);
    const freshnessScore = computeBatchFreshnessScore(batch, inspection);
    const shelfLifeDays = computeBatchShelfLife(batch, freshnessScore, inspection);
    const { probability: spoilageProbability, riskLevel, breakdown } =
        computeBatchSpoilage(batch, freshnessScore, shelfLifeDays, inspection);

    // --- Compute confidence based on available signal count ---
    const signalCount = [
        signals.visualScore,
        signals.firmness,
        signals.temperature,
        signals.humidity,
        signals.daysSinceHarvest,
    ].filter((v) => v !== null).length;
    const confidence = Math.min(1, signalCount * 0.2); // 0.2 per signal, max 1.0

    const predictionData = {
        batchId,
        inspectionId: inspection?._id || null,
        freshnessScore: freshnessScore ?? 50, // fallback if no signals
        shelfLifeDays: shelfLifeDays ?? 3,
        spoilageProbability: spoilageProbability ?? 0.2,
        riskLevel: riskLevel || "MEDIUM",
        confidence,
        source: "heuristic_mock", // ← change to "ml_python_service" when ready
        inputSignals: {
            visualScore: signals.visualScore,
            firmness: signals.firmness,
            temperature: signals.temperature,
            humidity: signals.humidity,
            daysSinceHarvest: signals.daysSinceHarvest
                ? Math.round(signals.daysSinceHarvest * 10) / 10
                : null,
            visibleDefects: signals.visibleDefects,
            brix: signals.brix,
        },
        riskBreakdown: breakdown,
        notes:
            confidence < 0.4
                ? "Low confidence — limited signal data available. Provide quality inspection for better accuracy."
                : null,
    };

    const prediction = await Prediction.create(predictionData);

    // Update batch cache — but never let a heuristic estimate overwrite the
    // cached values of a real image-based ML analysis.
    const hasMlAnalysis = await Prediction.exists({ batchId, source: "ml_python_service" });
    if (!hasMlAnalysis) {
        await updateBatchPredictionCache(batchId, {
            freshnessScore: predictionData.freshnessScore,
            shelfLifeDays: predictionData.shelfLifeDays,
            spoilageProbability: predictionData.spoilageProbability,
        });
    }

    logger.info("Prediction computed", {
        batchId,
        source: predictionData.source,
        freshnessScore: predictionData.freshnessScore,
        shelfLifeDays: predictionData.shelfLifeDays,
        riskLevel,
        confidence,
    });

    return prediction;
};

/**
 * Get the prediction history for a batch (most recent first).
 */
export const getPredictionHistory = async (batchId, limit = 10) => {
    return Prediction.find({ batchId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("inspectionId", "inspectionType createdAt");
};

/**
 * Get the latest prediction for a batch.
 * `source` (optional) restricts to one source, e.g. "ml_python_service".
 * With no source this returns the newest of ANY kind — fine for the numeric
 * pipelines (profit/recommendation) but NOT for the batch details view, which
 * uses getPreferredPrediction below.
 */
export const getLatestPrediction = async (batchId, source = null) => {
    const filter = source ? { batchId, source } : { batchId };
    return Prediction.findOne(filter)
        .sort({ createdAt: -1 })
        .populate("inspectionId", "inspectionType createdAt");
};

/**
 * Prediction for the main batch view: the latest real ML analysis if one
 * exists, otherwise the latest heuristic one. A newer heuristic run never
 * hides an older ML analysis. Callers can tell which they got from `.source`.
 */
export const getPreferredPrediction = async (batchId) => {
    return (
        (await getLatestPrediction(batchId, "ml_python_service")) ||
        (await getLatestPrediction(batchId))
    );
};
