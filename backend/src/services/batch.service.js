import Batch from "../models/Batch.js";
import QualityInspection from "../models/QualityInspection.js";
import Prediction from "../models/Prediction.js";
import ProfitAnalysis from "../models/ProfitAnalysis.js";
import Recommendation from "../models/Recommendation.js";
import MarketDemand from "../models/MarketDemand.js";
import logger from "../utils/logger.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Generate a human-readable batch code.
 * Format: <PRODUCE_PREFIX>-<TIMESTAMP_SUFFIX>
 * Example: MNG-1723180800000
 */
const generateBatchCode = (produceType) => {
    const prefix = (produceType || "BATCH").slice(0, 3).toUpperCase();
    return `${prefix}-${Date.now()}`;
};

// ── Service functions ─────────────────────────────────────────────────────────

export const createBatch = async (batchData) => {
    if (!batchData.batchCode) {
        batchData.batchCode = generateBatchCode(batchData.produceType);
    }
    const batch = await Batch.create(batchData);
    logger.info("Batch created", { batchCode: batch.batchCode });
    return batch;
};

/**
 * Get all batches with optional filtering.
 * @param {object} filters  - { produceType, status, currentLocation }
 * @param {object} options  - { page, limit, sortBy, sortOrder }
 */
export const getAllBatches = async (filters = {}, options = {}) => {
    const query = {};

    if (filters.produceType) query.produceType = filters.produceType.toLowerCase();
    if (filters.status) query.status = filters.status.toUpperCase();
    if (filters.currentLocation) {
        query.currentLocation = { $regex: filters.currentLocation, $options: "i" };
    }

    const page = Math.max(1, parseInt(options.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(options.limit) || 20));
    const skip = (page - 1) * limit;

    const sortBy = options.sortBy || "createdAt";
    const sortOrder = options.sortOrder === "asc" ? 1 : -1;

    const [batches, total] = await Promise.all([
        Batch.find(query)
            .sort({ [sortBy]: sortOrder })
            .skip(skip)
            .limit(limit),
        Batch.countDocuments(query),
    ]);

    return {
        batches,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
};

export const getBatchById = async (batchId) => {
    return Batch.findById(batchId);
};

export const getBatchByCode = async (batchCode) => {
    return Batch.findOne({ batchCode });
};

export const updateBatch = async (batchId, updateData) => {
    // Prevent overwriting the batchCode
    delete updateData.batchCode;

    const batch = await Batch.findByIdAndUpdate(batchId, updateData, {
        new: true,
        runValidators: true,
    });
    return batch;
};

export const deleteBatch = async (batchId) => {
    const deletedBatch = await Batch.findByIdAndDelete(batchId);
    if (deletedBatch) {
        // Cascading delete across all batch-dependent collections
        await Promise.allSettled([
            QualityInspection.deleteMany({ batchId }),
            Prediction.deleteMany({ batchId }),
            ProfitAnalysis.deleteMany({ batchId }),
            Recommendation.deleteMany({ batchId }),
            MarketDemand.deleteMany({ batchId }),
        ]);
        logger.info("Batch and associated child records deleted", { batchId });
    }
    return deletedBatch;
};

/**
 * Update the cached prediction fields on a batch.
 * Called by the prediction service after running freshness inference.
 */
export const updateBatchPredictionCache = async (batchId, predictionData) => {
    const { freshnessScore, shelfLifeDays, spoilageProbability } = predictionData;
    return Batch.findByIdAndUpdate(
        batchId,
        {
            latestFreshnessScore: freshnessScore,
            latestShelfLifeDays: shelfLifeDays,
            latestSpoilageProbability: spoilageProbability,
            latestPredictionAt: new Date(),
        },
        { new: true }
    );
};

/**
 * Get all ACTIVE batches sorted by urgency (lowest shelf life first).
 * Used by dashboard and recommendation engine.
 */
export const getActiveBatchesByUrgency = async () => {
    return Batch.find({ status: "ACTIVE" }).sort({
        latestShelfLifeDays: 1,
        latestSpoilageProbability: -1,
    });
};
