import express from "express";
import {
    createBatchController,
    getAllBatchesController,
    getBatchByIdController,
    updateBatchController,
    deleteBatchController,
} from "../controllers/batch.controller.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { resolveBatchParam } from "../middleware/resolveBatch.middleware.js";

const router = express.Router();

router.param("id", resolveBatchParam);

// Required fields for batch creation
const BATCH_REQUIRED_FIELDS = [
    "productName",
    "produceType",
    "quantity",
    "origin",
    "harvestDate",
    "arrivalDate",
    "currentLocation",
];

router.post("/", validateBody(BATCH_REQUIRED_FIELDS), createBatchController);
router.get("/", getAllBatchesController);
router.get("/:id", getBatchByIdController);
router.put("/:id", updateBatchController);
router.patch("/:id", updateBatchController);
router.delete("/:id", deleteBatchController);

export default router;
