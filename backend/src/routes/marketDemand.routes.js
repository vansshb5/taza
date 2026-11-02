import express from "express";
import {
    upsertMarketDataController,
    getMarketDataController,
    runDecisionController,
} from "../controllers/marketDemand.controller.js";
import { resolveBatchParam } from "../middleware/resolveBatch.middleware.js";

// mergeParams so :batchId from the mount point in app.js is available
const router = express.Router({ mergeParams: true });

router.param("batchId", resolveBatchParam);

// PUT  /api/batches/:batchId/market-data   -> create/update market+route batch
// GET  /api/batches/:batchId/market-data   -> fetch stored market+route data
// POST /api/batches/:batchId/decision      -> call Python POST /decision

router.put("/:batchId/market-data", upsertMarketDataController);
router.get("/:batchId/market-data", getMarketDataController);
router.post("/:batchId/decision", runDecisionController);

export default router;
