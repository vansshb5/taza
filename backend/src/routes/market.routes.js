import express from "express";
import {
    getMarketPricesController,
    getAvailableMarketsController,
    addMarketPriceController,
    getMarketOpportunitiesController,
} from "../controllers/market.controller.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { resolveBatchParam } from "../middleware/resolveBatch.middleware.js";

const router = express.Router();

router.param("batchId", resolveBatchParam);

// GET  /api/market/prices?produce=mango&location=delhi
// GET  /api/market/markets?produce=mango
// POST /api/market/prices
// GET  /api/market/opportunities/:batchId

router.get("/prices", getMarketPricesController);
router.get("/markets", getAvailableMarketsController);
router.post(
    "/prices",
    validateBody(["produceType", "market", "location", "pricePerKg"]),
    addMarketPriceController
);
router.get("/opportunities/:batchId", getMarketOpportunitiesController);

export default router;
