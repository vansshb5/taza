import express from "express";
import {
    getAllRecommendationsController,
    generateRecommendationController,
    getLatestRecommendationController,
    getRecommendationHistoryController,
} from "../controllers/recommendation.controller.js";
import { resolveBatchParam } from "../middleware/resolveBatch.middleware.js";

const router = express.Router();

router.param("batchId", resolveBatchParam);

// GET  /api/recommendations                     → all latest recommendations
// POST /api/recommendations/:batchId/generate  → run decision engine
// GET  /api/recommendations/:batchId           → latest recommendation
// GET  /api/recommendations/:batchId/history   → history

router.get("/", getAllRecommendationsController);
router.post("/:batchId/generate", generateRecommendationController);
router.get("/:batchId", getLatestRecommendationController);
router.get("/:batchId/history", getRecommendationHistoryController);

export default router;
