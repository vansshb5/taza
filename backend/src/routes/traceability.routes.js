import express from "express";
import {
    getBatchPassportController,
    getSupplyChainSummaryController,
} from "../controllers/traceability.controller.js";
import { resolveBatchParam } from "../middleware/resolveBatch.middleware.js";

const router = express.Router();

router.param("batchId", resolveBatchParam);

// GET /api/traceability/supply-chain/summary
// GET /api/traceability/:batchId

// Note: static route must come before parameterised route
router.get("/supply-chain/summary", getSupplyChainSummaryController);
router.get("/:batchId", getBatchPassportController);

export default router;
