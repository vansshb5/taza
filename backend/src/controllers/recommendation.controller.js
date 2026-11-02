import { generateRecommendation, getLatestRecommendation, getRecommendationHistory, getAllRecommendations } from "../services/recommendation.service.js";
import { sendSuccess, sendError } from "../utils/response.js";

/**
 * GET /api/recommendations
 * Get all latest recommendations across batches.
 */
export const getAllRecommendationsController = async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const recommendations = await getAllRecommendations(limit);
        return sendSuccess(res, 200, recommendations);
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/recommendations/:batchId/generate
 * Run the decision engine for a batch.
 */
export const generateRecommendationController = async (req, res, next) => {
    try {
        const recommendation = await generateRecommendation(req.params.batchId);
        return sendSuccess(res, 201, recommendation, "Recommendation generated");
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/recommendations/:batchId
 * Get the latest recommendation for a batch.
 */
export const getLatestRecommendationController = async (req, res, next) => {
    try {
        const recommendation = await getLatestRecommendation(req.params.batchId);
        if (!recommendation)
            return sendError(
                res,
                404,
                "No recommendation found. Run POST /api/recommendations/:batchId/generate first."
            );
        return sendSuccess(res, 200, recommendation);
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/recommendations/:batchId/history
 */
export const getRecommendationHistoryController = async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const history = await getRecommendationHistory(req.params.batchId, limit);
        return sendSuccess(res, 200, history);
    } catch (error) {
        next(error);
    }
};
