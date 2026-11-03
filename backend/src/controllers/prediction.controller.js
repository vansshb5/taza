import {
    runBatchPrediction,
    getPredictionHistory,
    getLatestPrediction,
    getPreferredPrediction,
} from "../services/prediction.service.js";
import { sendSuccess, sendError } from "../utils/response.js";

/**
 * POST /api/predictions/:batchId/run
 * Run a fresh prediction for a batch.
 */
export const runPredictionController = async (req, res, next) => {
    try {
        const prediction = await runBatchPrediction(req.params.batchId);
        return sendSuccess(res, 201, prediction, "Prediction computed successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/predictions/:batchId[?source=ml|heuristic|any]
 * Get the latest prediction for a batch (ML preferred by default).
 */
export const getLatestPredictionController = async (req, res, next) => {
    try {
        // ?source=ml | heuristic | any. Default: latest ML analysis, falling
        // back to a heuristic estimate only when no ML analysis exists.
        const sourceParam = req.query.source;
        const SOURCES = { ml: "ml_python_service", heuristic: "heuristic_mock" };
        if (sourceParam && sourceParam !== "any" && !SOURCES[sourceParam]) {
            return sendError(res, 400, "Invalid 'source'. Use ml, heuristic or any.");
        }
        const prediction =
            sourceParam === "any"
                ? await getLatestPrediction(req.params.batchId)
                : SOURCES[sourceParam]
                  ? await getLatestPrediction(req.params.batchId, SOURCES[sourceParam])
                  : await getPreferredPrediction(req.params.batchId);
        if (!prediction)
            return sendError(
                res,
                404,
                "No prediction found for this batch. Run POST /api/predictions/:batchId/run first."
            );
        return sendSuccess(res, 200, prediction);
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/predictions/:batchId/history
 * Get prediction history for a batch.
 */
export const getPredictionHistoryController = async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const history = await getPredictionHistory(req.params.batchId, limit);
        return sendSuccess(res, 200, history);
    } catch (error) {
        next(error);
    }
};
