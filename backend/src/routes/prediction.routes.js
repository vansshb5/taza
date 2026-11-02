import express from "express";
import {
    runPredictionController,
    getLatestPredictionController,
    getPredictionHistoryController,
} from "../controllers/prediction.controller.js";
import { getBatchInsightsController } from "../controllers/analysis.controller.js";
import { resolveBatchParam } from "../middleware/resolveBatch.middleware.js";

const router = express.Router();

router.param("batchId", resolveBatchParam);

// POST /api/predictions/:batchId/run       → run a new prediction
// GET  /api/predictions/:batchId           → latest prediction
// GET  /api/predictions/:batchId/history   → prediction history
// GET  /api/predictions/:batchId/insights  → get AI natural-language explanation
// POST /api/predictions/:batchId/insights → generate AI explanation

router.post("/:batchId/run", runPredictionController);
router.get("/:batchId", getLatestPredictionController);
router.get("/:batchId/history", getPredictionHistoryController);
router.get("/:batchId/insights", getBatchInsightsController);
router.post("/:batchId/insights", getBatchInsightsController);

export default router;
