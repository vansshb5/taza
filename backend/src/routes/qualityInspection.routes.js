import express from "express";
import {
    createInspectionController,
    getInspectionsController,
    getInspectionByIdController,
    deleteInspectionController,
} from "../controllers/qualityInspection.controller.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { resolveBatchParam } from "../middleware/resolveBatch.middleware.js";

const router = express.Router({ mergeParams: true });

router.param("batchId", resolveBatchParam);

// POST   /api/batches/:batchId/inspections
// GET    /api/batches/:batchId/inspections
// GET    /api/batches/:batchId/inspections/:inspectionId
// DELETE /api/batches/:batchId/inspections/:inspectionId

router.post(
    "/:batchId/inspections",
    validateBody(["inspectionType"]),
    createInspectionController
);

router.get("/:batchId/inspections", getInspectionsController);

router.get(
    "/:batchId/inspections/:inspectionId",
    getInspectionByIdController
);

router.delete(
    "/:batchId/inspections/:inspectionId",
    deleteInspectionController
);

export default router;
