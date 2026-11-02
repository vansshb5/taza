import express from "express";
import {
    analyzeBatchController,
    getBatchInsightsController,
} from "../controllers/analysis.controller.js";
import { uploadBatchImages } from "../middleware/upload.middleware.js";
import { resolveBatchParam } from "../middleware/resolveBatch.middleware.js";

const router = express.Router({ mergeParams: true });

router.param("batchId", resolveBatchParam);

// POST /api/batches/:batchId/analyze           (multipart: images[] + storage fields)
// POST /api/batches/:batchId/analyze/insights   (optional "✨ Get AI Insights")
// GET  /api/batches/:batchId/analyze/insights   (read existing insights)

router.post("/:batchId/analyze", uploadBatchImages, analyzeBatchController);
router.post("/:batchId/analyze/insights", getBatchInsightsController);
router.get("/:batchId/analyze/insights", getBatchInsightsController);

export default router;
