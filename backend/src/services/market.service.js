/**
 * Market Service
 *
 * Handles:
 * 1. Querying market prices (by produce + location)
 * 2. Computing market opportunities for a batch
 *    (price × expected sellable quantity − transport cost)
 * 3. Seeding demo market data (clearly labelled)
 */

import MarketPrice from "../models/MarketPrice.js";
import { computeTransportSpoilage } from "../utils/calculations.js";
import logger from "../utils/logger.js";

// ── Price Queries ─────────────────────────────────────────────────────────────

/**
 * Get the most recent market prices for a produce type.
 * Optionally filter by location.
 * Returns prices from the last 7 days, most recent first.
 *
 * @param {string} produceType
 * @param {string|null} location
 * @returns {MarketPrice[]}
 */
export const getMarketPrices = async (produceType, location = null) => {
    const query = { produceType: produceType.toLowerCase() };

    if (location) {
        query.location = { $regex: location, $options: "i" };
    }

    // Last 7 days of data
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    query.$or = [
        { observationDate: { $gte: sevenDaysAgo } },
        { source: "demo_seed" },
    ];

    return MarketPrice.find(query)
        .sort({ observationDate: -1 })
        .limit(50);
};

/**
 * Get the single most recent price for a produce type in a specific location.
 */
export const getLatestPriceForLocation = async (produceType, location) => {
    return MarketPrice.findOne({
        produceType: produceType.toLowerCase(),
        location: { $regex: location, $options: "i" },
    }).sort({ observationDate: -1 });
};

/**
 * Get all distinct markets that have price data for a produce type.
 */
export const getAvailableMarkets = async (produceType) => {
    return MarketPrice.distinct("location", {
        produceType: produceType.toLowerCase(),
    });
};

/**
 * Add a new market price record.
 */
export const addMarketPrice = async (priceData) => {
    const price = await MarketPrice.create(priceData);
    logger.info("Market price recorded", {
        produceType: price.produceType,
        market: price.market,
        pricePerKg: price.pricePerKg,
    });
    return price;
};

// ── Market Opportunity Calculation ────────────────────────────────────────────

/**
 * Calculate the market opportunity for a batch across all known markets
 * for that produce type.
 *
 * For each market:
 * - Get the latest price
 * - Calculate expected spoilage during transport
 * - Calculate expected sellable quantity
 * - Calculate expected gross revenue
 * - Calculate transport cost
 * - Calculate net opportunity value
 *
 * @param {object} batch          - Mongoose Batch document
 * @param {object} predictionData - { freshnessScore, shelfLifeDays, spoilageProbability }
 * @param {object[]} marketPrices - Array of MarketPrice documents
 * @param {object} transportConfig - { [location]: { costPerKg, timeHours } }
 * @returns {object[]} Ranked market opportunities
 */
export const computeMarketOpportunities = (
    batch,
    predictionData,
    marketPrices,
    transportConfig = {}
) => {
    const { shelfLifeDays, spoilageProbability } = predictionData;
    const quantity = batch.quantity;

    // Group prices by location (take the most recent per location)
    const latestByLocation = {};
    for (const price of marketPrices) {
        const loc = price.location.toLowerCase();
        if (!latestByLocation[loc]) {
            latestByLocation[loc] = price;
        }
    }

    const opportunities = [];

    for (const [loc, price] of Object.entries(latestByLocation)) {
        const transport = transportConfig[loc] || transportConfig[price.location] || null;

        const transportCostPerKg = transport?.costPerKg ?? null;
        const transportTimeHours = transport?.timeHours ?? price.estimatedTransportTimeHours ?? null;
        const transportTimeDays = transportTimeHours !== null ? transportTimeHours / 24 : null;

        // Estimate spoilage fraction during transit
        const transitSpoilageFraction =
            transportTimeDays !== null && shelfLifeDays !== null
                ? computeTransportSpoilage({
                    shelfLifeDays,
                    transportTimeDays,
                    baseSpoilageProbability: spoilageProbability || 0,
                })
                : spoilageProbability || 0;

        const sellableQuantity = Math.max(0, quantity * (1 - transitSpoilageFraction));
        const spoiledQuantity = quantity - sellableQuantity;

        const transportCostTotal =
            transportCostPerKg !== null ? transportCostPerKg * quantity : null;

        const expectedRevenue = sellableQuantity * price.pricePerKg;

        const netOpportunityValue =
            transportCostTotal !== null
                ? expectedRevenue - transportCostTotal
                : null;

        // Risk assessment for this destination
        const shelfLifeMargin =
            shelfLifeDays !== null && transportTimeDays !== null
                ? shelfLifeDays - transportTimeDays
                : null;

        const risk =
            shelfLifeMargin === null
                ? "UNKNOWN"
                : shelfLifeMargin <= 0
                ? "CRITICAL"
                : shelfLifeMargin < 0.5
                ? "HIGH"
                : shelfLifeMargin < 1
                ? "MEDIUM"
                : "LOW";

        opportunities.push({
            market: price.market,
            location: price.location,
            pricePerKg: price.pricePerKg,
            priceMin: price.priceMin,
            priceMax: price.priceMax,
            demandLevel: price.demandLevel,
            isEstimate: price.isEstimate,
            priceSource: price.source,
            priceObservationDate: price.observationDate,

            transportCostPerKg,
            transportCostTotal: transportCostTotal !== null ? Math.round(transportCostTotal) : null,
            transportTimeHours,
            transportTimeDays,

            expectedSpoilageFraction: Math.round(transitSpoilageFraction * 100) / 100,
            expectedSpoilagePercent: Math.round(transitSpoilageFraction * 100 * 10) / 10,
            expectedSellableQuantity: Math.round(sellableQuantity * 10) / 10,
            expectedSpoiledQuantity: Math.round(spoiledQuantity * 10) / 10,

            expectedRevenue: Math.round(expectedRevenue),
            netOpportunityValue: netOpportunityValue !== null ? Math.round(netOpportunityValue) : null,

            shelfLifeMarginDays: shelfLifeMargin !== null ? Math.round(shelfLifeMargin * 10) / 10 : null,
            risk,

            // Flag: is delivery feasible within remaining shelf life?
            isFeasible: shelfLifeMargin === null ? null : shelfLifeMargin > 0,
        });
    }

    // Sort by net opportunity value (highest first), unknowns last
    opportunities.sort((a, b) => {
        if (a.netOpportunityValue === null) return 1;
        if (b.netOpportunityValue === null) return -1;
        return b.netOpportunityValue - a.netOpportunityValue;
    });

    return opportunities;
};

// ── Demo Seed Data ─────────────────────────────────────────────────────────────
// IMPORTANT: These are DEMO prices for hackathon demonstration purposes only.
// They do NOT represent actual current market prices.
// Label: source = "demo_seed", isEstimate = true

export const seedDemoMarketPrices = async () => {
    const existingCount = await MarketPrice.countDocuments({ source: "demo_seed" });
    if (existingCount > 0) {
        logger.info("Demo market prices already seeded — skipping");
        return;
    }

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const demoData = [
        // Mango prices across markets
        { produceType: "mango", market: "Azadpur", location: "Delhi", state: "Delhi", pricePerKg: 80, priceMin: 70, priceMax: 95, demandLevel: "HIGH", estimatedTransportTimeHours: 1, distanceFromKm: 20 },
        { produceType: "mango", market: "Jaipur APMC", location: "Jaipur", state: "Rajasthan", pricePerKg: 92, priceMin: 85, priceMax: 100, demandLevel: "MEDIUM", estimatedTransportTimeHours: 5, distanceFromKm: 280 },
        { produceType: "mango", market: "Chandigarh Grain Market", location: "Chandigarh", state: "Punjab", pricePerKg: 88, priceMin: 80, priceMax: 96, demandLevel: "HIGH", estimatedTransportTimeHours: 4, distanceFromKm: 250 },
        { produceType: "mango", market: "Agra Mandi", location: "Agra", state: "Uttar Pradesh", pricePerKg: 76, priceMin: 68, priceMax: 85, demandLevel: "MEDIUM", estimatedTransportTimeHours: 3, distanceFromKm: 205 },
        { produceType: "mango", market: "Lucknow Mandi", location: "Lucknow", state: "Uttar Pradesh", pricePerKg: 84, priceMin: 75, priceMax: 92, demandLevel: "HIGH", estimatedTransportTimeHours: 7, distanceFromKm: 550 },

        // Tomato prices
        { produceType: "tomato", market: "Azadpur", location: "Delhi", state: "Delhi", pricePerKg: 30, priceMin: 25, priceMax: 40, demandLevel: "HIGH", estimatedTransportTimeHours: 1, distanceFromKm: 20 },
        { produceType: "tomato", market: "Jaipur APMC", location: "Jaipur", state: "Rajasthan", pricePerKg: 35, priceMin: 28, priceMax: 45, demandLevel: "MEDIUM", estimatedTransportTimeHours: 5, distanceFromKm: 280 },
        { produceType: "tomato", market: "Chandigarh Grain Market", location: "Chandigarh", state: "Punjab", pricePerKg: 38, priceMin: 30, priceMax: 48, demandLevel: "HIGH", estimatedTransportTimeHours: 4, distanceFromKm: 250 },

        // Banana prices
        { produceType: "banana", market: "Azadpur", location: "Delhi", state: "Delhi", pricePerKg: 22, priceMin: 18, priceMax: 28, demandLevel: "HIGH", estimatedTransportTimeHours: 1, distanceFromKm: 20 },
        { produceType: "banana", market: "Jaipur APMC", location: "Jaipur", state: "Rajasthan", pricePerKg: 26, priceMin: 20, priceMax: 32, demandLevel: "MEDIUM", estimatedTransportTimeHours: 5, distanceFromKm: 280 },

        // Potato prices
        { produceType: "potato", market: "Azadpur", location: "Delhi", state: "Delhi", pricePerKg: 15, priceMin: 12, priceMax: 20, demandLevel: "HIGH", estimatedTransportTimeHours: 1, distanceFromKm: 20 },
        { produceType: "potato", market: "Jaipur APMC", location: "Jaipur", state: "Rajasthan", pricePerKg: 18, priceMin: 14, priceMax: 22, demandLevel: "MEDIUM", estimatedTransportTimeHours: 5, distanceFromKm: 280 },

        // Onion prices
        { produceType: "onion", market: "Lasalgaon APMC", location: "Nashik", state: "Maharashtra", pricePerKg: 20, priceMin: 15, priceMax: 28, demandLevel: "HIGH", estimatedTransportTimeHours: 8, distanceFromKm: 160 },
        { produceType: "onion", market: "Azadpur", location: "Delhi", state: "Delhi", pricePerKg: 28, priceMin: 22, priceMax: 35, demandLevel: "HIGH", estimatedTransportTimeHours: 1, distanceFromKm: 20 },
    ];

    const records = demoData.map((d) => ({
        ...d,
        observationDate: today,
        source: "demo_seed",
        isEstimate: true,
        confidenceLevel: "LOW",
        notes: "DEMO DATA — for hackathon demonstration only. Not actual market prices.",
    }));

    await MarketPrice.insertMany(records);
    logger.info(`Demo market prices seeded: ${records.length} records`);
};
