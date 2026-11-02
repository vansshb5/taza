/**
 * Taza — Pure calculation functions for the freshness/market/profit engines.
 *
 * These are DETERMINISTIC functions with no side effects.
 * All business-logic math lives here so it can be tested independently.
 *
 * All monetary values are in ₹ (Indian Rupees).
 * All weights are in kg.
 * All times are in days unless stated otherwise.
 */

// ── Freshness ─────────────────────────────────────────────────────────────────

/**
 * Compute a weighted freshness score (0–100) from available signals.
 * Missing signals are excluded from the weighted average so the score
 * remains meaningful even with partial data.
 *
 * Weights reflect approximate relative importance to produce quality.
 */
export const computeFreshnessScore = ({
    visualScore = null,       // 0–100 from image inspection
    firmness = null,          // 0–100
    temperature = null,       // °C — compared against ideal range
    humidity = null,          // 0–100 %
    daysSinceHarvest = null,  // integer days
    produceType = "generic",  // used to look up reference shelf life
    brix = null,              // sugar content (higher = riper)
}) => {
    const components = [];

    // Visual quality contribution (weight: 35%)
    if (visualScore !== null) {
        components.push({ score: Math.max(0, Math.min(100, visualScore)), weight: 35 });
    }

    // Firmness contribution (weight: 20%)
    if (firmness !== null) {
        components.push({ score: Math.max(0, Math.min(100, firmness)), weight: 20 });
    }

    // Age contribution (weight: 25%) — score degrades as age approaches reference shelf life
    if (daysSinceHarvest !== null) {
        const refLife = REFERENCE_SHELF_LIFE_DAYS[produceType] || 7;
        const ageRatio = Math.min(daysSinceHarvest / refLife, 1);
        const ageScore = Math.max(0, (1 - ageRatio) * 100);
        components.push({ score: ageScore, weight: 25 });
    }

    // Temperature contribution (weight: 12%)
    if (temperature !== null) {
        const ideal = IDEAL_STORAGE_TEMP[produceType] || { min: 4, max: 12 };
        const tempScore = computeTemperatureScore(temperature, ideal.min, ideal.max);
        components.push({ score: tempScore, weight: 12 });
    }

    // Humidity contribution (weight: 8%)
    if (humidity !== null) {
        // Ideal humidity for most produce: 85–95%
        const humidityScore = computeHumidityScore(humidity, 80, 95);
        components.push({ score: humidityScore, weight: 8 });
    }

    if (components.length === 0) return null;

    const totalWeight = components.reduce((s, c) => s + c.weight, 0);
    const weightedSum = components.reduce((s, c) => s + c.score * c.weight, 0);
    return Math.round((weightedSum / totalWeight) * 10) / 10; // 1 decimal place
};

const computeTemperatureScore = (actual, idealMin, idealMax) => {
    if (actual >= idealMin && actual <= idealMax) return 100;
    const deviation = actual < idealMin ? idealMin - actual : actual - idealMax;
    // Penalty: -8 points per degree outside ideal range, min 0
    return Math.max(0, 100 - deviation * 8);
};

const computeHumidityScore = (actual, idealMin, idealMax) => {
    if (actual >= idealMin && actual <= idealMax) return 100;
    const deviation = actual < idealMin ? idealMin - actual : actual - idealMax;
    return Math.max(0, 100 - deviation * 3);
};

// ── Shelf Life ────────────────────────────────────────────────────────────────

/**
 * Estimate remaining commercially useful shelf life in days.
 *
 * Uses a heuristic degradation model:
 *   remainingLife = referenceLife × (freshnessScore / 100) × temperatureFactor
 *
 * This is a transparent heuristic — it will be replaced by the Python ML model.
 */
export const computeShelfLifeDays = ({
    freshnessScore,
    produceType = "generic",
    temperature = null,
    daysSinceHarvest = null,
}) => {
    if (freshnessScore === null || freshnessScore === undefined) return null;

    const refLife = REFERENCE_SHELF_LIFE_DAYS[produceType] || 7;

    // Base: remaining life proportional to freshness
    let remaining = refLife * (freshnessScore / 100);

    // If we know days since harvest, we can subtract what's already been used
    // and use the smaller of the two estimates to be conservative
    if (daysSinceHarvest !== null) {
        const ageBasedRemaining = Math.max(0, refLife - daysSinceHarvest);
        remaining = Math.min(remaining, ageBasedRemaining);
    }

    // Temperature acceleration factor
    // Every 10°C above ideal doubles degradation rate (Q10 = 2 heuristic)
    if (temperature !== null) {
        const ideal = IDEAL_STORAGE_TEMP[produceType] || { min: 4, max: 12 };
        const idealMid = (ideal.min + ideal.max) / 2;
        if (temperature > idealMid) {
            const tempExcess = temperature - idealMid;
            const accelerationFactor = Math.pow(2, tempExcess / 10);
            remaining = remaining / accelerationFactor;
        }
    }

    return Math.max(0, Math.round(remaining * 10) / 10); // 1 decimal place, min 0
};

// ── Spoilage ──────────────────────────────────────────────────────────────────

/**
 * Estimate spoilage probability (0–1) and per-factor breakdown.
 */
export const computeSpoilageProbability = ({
    freshnessScore,
    shelfLifeDays,
    daysSinceHarvest = null,
    produceType = "generic",
    temperature = null,
    visibleDefects = [],
}) => {
    const risks = {};

    // Age risk
    if (daysSinceHarvest !== null) {
        const refLife = REFERENCE_SHELF_LIFE_DAYS[produceType] || 7;
        risks.ageRisk = Math.min(1, daysSinceHarvest / refLife);
    }

    // Freshness degradation risk (inverted freshness)
    const freshnessRisk = freshnessScore !== null
        ? Math.max(0, (100 - freshnessScore) / 100)
        : null;
    if (freshnessRisk !== null) risks.freshnessRisk = freshnessRisk;

    // Visual defect risk
    if (visibleDefects.length > 0) {
        const severeDefects = ["mold", "rot", "cracks", "bruising"];
        const hasSevere = visibleDefects.some((d) =>
            severeDefects.some((s) => d.toLowerCase().includes(s))
        );
        risks.visualDefectRisk = hasSevere ? 0.5 : Math.min(0.3, visibleDefects.length * 0.08);
    }

    // Temperature stress risk
    if (temperature !== null) {
        const ideal = IDEAL_STORAGE_TEMP[produceType] || { min: 4, max: 12 };
        if (temperature > ideal.max) {
            const excess = temperature - ideal.max;
            risks.temperatureStressRisk = Math.min(1, excess * 0.05);
        } else if (temperature < ideal.min) {
            const excess = ideal.min - temperature;
            risks.temperatureStressRisk = Math.min(0.3, excess * 0.03);
        }
    }

    // Shelf life urgency risk (very low shelf life → high spoilage risk)
    if (shelfLifeDays !== null) {
        risks.shelfLifeUrgencyRisk = shelfLifeDays < 0.5 ? 0.9 :
            shelfLifeDays < 1 ? 0.6 :
            shelfLifeDays < 2 ? 0.3 :
            shelfLifeDays < 3 ? 0.1 : 0;
    }

    // Combine risks (weighted average, not sum — avoids > 1)
    const riskValues = Object.values(risks).filter((v) => v !== null && v !== undefined);
    if (riskValues.length === 0) return { probability: null, breakdown: {} };

    // Use a "probability of union" style combination to avoid simple averaging underestimating
    let combined = 0;
    for (const r of riskValues) {
        combined = combined + r - combined * r; // P(A∪B) = P(A) + P(B) - P(A)P(B)
    }

    return {
        probability: Math.min(1, Math.round(combined * 100) / 100),
        breakdown: {
            visualDefectRisk: risks.visualDefectRisk || null,
            temperatureStressRisk: risks.temperatureStressRisk || null,
            ageRisk: risks.ageRisk || null,
            storageRisk: risks.shelfLifeUrgencyRisk || null,
        },
    };
};

/**
 * Convert a spoilage probability (0–1) to a human-readable risk level.
 */
export const probabilityToRiskLevel = (probability) => {
    if (probability === null || probability === undefined) return "UNKNOWN";
    if (probability >= 0.7) return "CRITICAL";
    if (probability >= 0.45) return "HIGH";
    if (probability >= 0.2) return "MEDIUM";
    return "LOW";
};

// ── Transport Spoilage ────────────────────────────────────────────────────────

/**
 * Estimate additional spoilage % caused by transportation.
 *
 * Key principle: if transport time ≥ remaining shelf life, spoilage risk is very high.
 * Transport adds stress: we use a conservative 1.2× acceleration multiplier for handling.
 *
 * Returns a number 0–1 (fraction of batch expected to spoil during transit).
 */
export const computeTransportSpoilage = ({
    shelfLifeDays,
    transportTimeDays,
    baseSpoilageProbability = 0,
}) => {
    if (shelfLifeDays === null || shelfLifeDays === undefined) return null;

    const ratio = transportTimeDays / Math.max(shelfLifeDays, 0.1);

    // If transport takes more than the entire remaining shelf life → very high spoilage
    if (ratio >= 1) return Math.min(1, baseSpoilageProbability + 0.5);

    // Handling stress multiplier (conservative 1.2×)
    const handlingStress = 1.2;
    const additionalSpoilage = ratio * handlingStress * 0.3; // max ~30% additional at ratio=1

    return Math.min(1, Math.round((baseSpoilageProbability + additionalSpoilage) * 100) / 100);
};

// ── Profit / Loss ─────────────────────────────────────────────────────────────

/**
 * Calculate expected economics for a single destination/action.
 *
 * Returns a structured object with every cost/revenue component.
 * Missing inputs are flagged in `missingInputs` so the UI can inform the user.
 */
export const computeExpectedProfitLoss = ({
    quantity,                   // kg
    pricePerKg,                 // ₹/kg at destination
    transportCostTotal,         // ₹ total (not per kg)
    spoilageFraction,           // 0–1 fraction of batch expected to spoil
    procurementCostPerKg = null, // ₹/kg — null means unknown
    storageCostPerKgPerDay = null, // ₹/kg/day — null means unknown
    storageDaysRemaining = 0,   // days in storage before sale
    otherCostsTotal = 0,        // ₹ any other known costs
}) => {
    const missingInputs = [];

    const sellableQuantity = Math.max(0, quantity * (1 - spoilageFraction));
    const spoiledQuantity = quantity - sellableQuantity;

    const grossRevenue = sellableQuantity * pricePerKg;

    let procurementCost = null;
    if (procurementCostPerKg !== null) {
        procurementCost = quantity * procurementCostPerKg;
    } else {
        missingInputs.push("procurementCostPerKg");
    }

    let storageCost = null;
    if (storageCostPerKgPerDay !== null) {
        storageCost = quantity * storageCostPerKgPerDay * storageDaysRemaining;
    } else {
        missingInputs.push("storageCostPerKgPerDay");
    }

    const knownCosts =
        transportCostTotal +
        (procurementCost || 0) +
        (storageCost || 0) +
        otherCostsTotal;

    const spoilageLoss = spoiledQuantity * (procurementCostPerKg || 0);

    const expectedProfit =
        procurementCost !== null
            ? grossRevenue - knownCosts
            : null; // cannot compute profit without procurement cost

    const wastePercent = Math.round((spoiledQuantity / quantity) * 100 * 10) / 10;
    const profitPerKg =
        expectedProfit !== null
            ? Math.round((expectedProfit / quantity) * 100) / 100
            : null;

    return {
        quantity,
        sellableQuantity: Math.round(sellableQuantity * 10) / 10,
        spoiledQuantity: Math.round(spoiledQuantity * 10) / 10,
        grossRevenue: Math.round(grossRevenue),
        transportCost: Math.round(transportCostTotal),
        procurementCost: procurementCost !== null ? Math.round(procurementCost) : null,
        storageCost: storageCost !== null ? Math.round(storageCost) : null,
        otherCosts: Math.round(otherCostsTotal),
        spoilageLoss: Math.round(spoilageLoss),
        expectedRevenue: Math.round(grossRevenue),
        expectedProfit: expectedProfit !== null ? Math.round(expectedProfit) : null,
        profitPerKg,
        wastePercent,
        missingInputs,
        isPartialCalculation: missingInputs.length > 0,
    };
};

// ── Reference Data ────────────────────────────────────────────────────────────
// Conservative estimates for common Indian fresh produce.
// These are heuristic reference values, not laboratory data.

export const REFERENCE_SHELF_LIFE_DAYS = {
    mango: 7,
    tomato: 5,
    banana: 4,
    potato: 90,
    onion: 60,
    apple: 30,
    orange: 14,
    grape: 7,
    spinach: 3,
    cauliflower: 5,
    cabbage: 14,
    carrot: 21,
    capsicum: 7,
    cucumber: 5,
    watermelon: 10,
    papaya: 5,
    guava: 4,
    pomegranate: 14,
    lemon: 14,
    ginger: 30,
    garlic: 60,
    generic: 7,
};

export const IDEAL_STORAGE_TEMP = {
    mango: { min: 10, max: 13 },
    tomato: { min: 10, max: 15 },
    banana: { min: 13, max: 15 },
    potato: { min: 4, max: 8 },
    onion: { min: 0, max: 4 },
    apple: { min: 0, max: 4 },
    orange: { min: 4, max: 8 },
    grape: { min: 0, max: 2 },
    spinach: { min: 0, max: 2 },
    cauliflower: { min: 0, max: 2 },
    carrot: { min: 0, max: 2 },
    generic: { min: 4, max: 12 },
};
