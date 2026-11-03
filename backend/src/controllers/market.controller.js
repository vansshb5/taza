import {
    getMarketPrices,
    getAvailableMarkets,
    addMarketPrice,
    computeMarketOpportunities,
} from "../services/market.service.js";
import { getBatchById } from "../services/batch.service.js";
import { getPreferredPrediction } from "../services/prediction.service.js";
import { sendSuccess, sendError } from "../utils/response.js";

/**
 * GET /api/market/prices
 * Query: ?produce=mango&location=delhi
 */
export const getMarketPricesController = async (req, res, next) => {
    try {
        const { produce, location } = req.query;
        if (!produce)
            return sendError(res, 400, "Query parameter 'produce' is required");

        const prices = await getMarketPrices(produce, location || null);

        return sendSuccess(res, 200, prices, null, {
            disclaimer:
                "Prices may include estimated/demo data. Check 'isEstimate' and 'source' fields on each record.",
            count: prices.length,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/market/markets?produce=mango
 */
export const getAvailableMarketsController = async (req, res, next) => {
    try {
        const { produce } = req.query;
        if (!produce)
            return sendError(res, 400, "Query parameter 'produce' is required");

        const markets = await getAvailableMarkets(produce);
        return sendSuccess(res, 200, markets);
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/market/prices
 * Add a new market price record.
 */
export const addMarketPriceController = async (req, res, next) => {
    try {
        const price = await addMarketPrice(req.body);
        return sendSuccess(res, 201, price, "Market price recorded");
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/market/opportunities/:batchId
 *
 * Returns market opportunities for a batch ranked by net opportunity value.
 * Requires a prediction to exist for the batch (run /api/predictions/:batchId/run first).
 *
 * Optional query param: transportConfig JSON (see market.service.js for shape)
 */
export const getMarketOpportunitiesController = async (req, res, next) => {
    try {
        const batch = await getBatchById(req.params.batchId);
        if (!batch) return sendError(res, 404, "Batch not found");

        const prediction = await getPreferredPrediction(req.params.batchId);
        if (!prediction)
            return sendError(
                res,
                404,
                "No prediction found for this batch. Run POST /api/predictions/:batchId/run first."
            );

        // Load market prices for the produce type
        const marketPrices = await getMarketPrices(batch.produceType);
        if (marketPrices.length === 0) {
            return sendError(
                res,
                404,
                `No market price data found for produce type '${batch.produceType}'. Add prices via POST /api/market/prices.`
            );
        }

        // Optional: caller can provide transport config as a JSON query param
        let transportConfig = {};
        if (req.query.transportConfig) {
            try {
                transportConfig = JSON.parse(req.query.transportConfig);
            } catch {
                return sendError(res, 400, "Invalid transportConfig JSON in query parameter");
            }
        }

        const opportunities = computeMarketOpportunities(
            batch,
            {
                freshnessScore: prediction.freshnessScore,
                shelfLifeDays: prediction.shelfLifeDays,
                spoilageProbability: prediction.spoilageProbability,
            },
            marketPrices,
            transportConfig
        );

        return sendSuccess(res, 200, {
            batchId: batch._id,
            batchCode: batch.batchCode,
            produceType: batch.produceType,
            productName: batch.productName,
            quantity: batch.quantity,
            unit: batch.unit,
            currentLocation: batch.currentLocation,
            freshnessScore: prediction.freshnessScore,
            shelfLifeDays: prediction.shelfLifeDays,
            spoilageProbability: prediction.spoilageProbability,
            riskLevel: prediction.riskLevel,
            predictionSource: prediction.source,
            markets: opportunities,
            disclaimer:
                "Market opportunity calculations are estimates based on available price and prediction data.",
        });
    } catch (error) {
        next(error);
    }
};
