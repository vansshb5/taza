/**
 * Analysis Controller
 *
 * Bridges the "Analyze Batch" / "✨ Get AI Insights" buttons in the React
 * app to the Python AI service, via mlProxy.service.js. This is the real
 * ML-backed path — separate from prediction.controller.js's existing
 * heuristic-only /api/predictions/:batchId/run, which stays as a
 * lightweight fallback for batches with no images.
 *
 * Field-name mapping (frontend FormData key → controller reads):
 *   temperature           → temperatureC     (alias)
 *   temperatureC          → temperatureC
 *   humidity              → humidityPercent  (alias)
 *   humidityPercent       → humidityPercent
 *   daysSinceHarvest      → harvestAgeDays   (alias)
 *   harvestAgeDays        → harvestAgeDays
 *   transportDurationHours→ transportDurationHours
 *   storageDurationHours  → storageDurationHours
 *   storageType           → storageType
 *   storageLocation       → storageLocation  (informational, not forwarded to Python)
 */
import { getBatchById, updateBatchPredictionCache } from "../services/batch.service.js";
import { analyzeBatch, getAgentInsights, MLServiceError } from "../services/mlProxy.service.js";
import Prediction from "../models/Prediction.js";
import QualityInspection from "../models/QualityInspection.js";
import Recommendation from "../models/Recommendation.js";
import { sendSuccess, sendError } from "../utils/response.js";
import logger from "../utils/logger.js";

const parseJSONField = (raw, fallback) => {
    if (!raw) return fallback;
    try {
        return typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
        return fallback;
    }
};

const riskLevelFromDecision = (shelfLife) => {
    const risk = shelfLife?.assessment?.spoilage_risk;
    if (risk === "HIGH") return "HIGH";
    if (risk === "MEDIUM") return "MEDIUM";
    if (risk === "LOW") return "LOW";
    return "MEDIUM";
};

/**
 * Read a numeric body field, accepting either of two alternate names.
 * Returns undefined (not null) when absent so callers can use `?? undefined`.
 */
const readNumber = (body, primaryKey, aliasKey) => {
    const raw = body[primaryKey] ?? body[aliasKey];
    if (raw === undefined || raw === null || raw === "") return undefined;
    const n = Number(raw);
    return Number.isNaN(n) ? undefined : n;
};

/**
 * POST /api/batches/:batchId/analyze
 * multipart/form-data: images[] (required), plus optional storage fields.
 *
 * Accepts both the frontend's camelCase aliases AND the backend-canonical names:
 *   temperature / temperatureC
 *   humidity / humidityPercent
 *   daysSinceHarvest / harvestAgeDays
 *   transportDurationHours
 *   storageDurationHours
 *   storageType
 *   markets / routes / localMarket (each a JSON string)
 */
export const analyzeBatchController = async (req, res, next) => {
    try {
        const { batchId } = req.params;
        logger.info("[EXPRESS] analyze request received", { batchId });
        const batch = await getBatchById(batchId);
        if (!batch) return sendError(res, 404, "Batch not found");

        if (!req.files || req.files.length === 0) {
            logger.warn("[EXPRESS] no images in request — rejecting", {
                batchId,
                contentType: req.headers["content-type"],
                bodyKeys: Object.keys(req.body || {}),
            });
            return sendError(res, 422, "At least one produce image is required (field name 'images').");
        }

        // ----------------------------------------------------------------
        // Resolve storage fields — accept both camelCase aliases (frontend)
        // and the canonical backend names.
        // ----------------------------------------------------------------
        const storage = {
            harvestAgeDays: readNumber(req.body, "harvestAgeDays", "daysSinceHarvest"),
            temperatureC:
                readNumber(req.body, "temperatureC", "temperature") ??
                (batch.storageTemperatureCelsius != null ? batch.storageTemperatureCelsius : undefined),
            humidityPercent:
                readNumber(req.body, "humidityPercent", "humidity") ??
                (batch.storageHumidityPercent != null ? batch.storageHumidityPercent : undefined),
            storageDurationHours: readNumber(req.body, "storageDurationHours", null),
            transportDurationHours: readNumber(req.body, "transportDurationHours", null),
            storageType: req.body.storageType || undefined,
        };

        const markets = parseJSONField(req.body.markets, []);
        const routes = parseJSONField(req.body.routes, []);
        const localMarket = parseJSONField(req.body.localMarket, null);

        logger.info("[EXPRESS] storage inputs resolved", {
            batchId,
            harvestAgeDays: storage.harvestAgeDays,
            temperatureC: storage.temperatureC,
            humidityPercent: storage.humidityPercent,
            transportDurationHours: storage.transportDurationHours,
            storageType: storage.storageType,
        });

        const result = await analyzeBatch({
            batchId: batch._id.toString(),
            produce: batch.produceType,
            quantityKg: batch.quantity,
            images: req.files,
            storage,
            markets,
            routes,
            localMarket,
        });

        const { cv_analysis: cv, shelf_life: shelfLife, decision } = result;

        const estimatedDays = shelfLife?.assessment?.estimated_remaining_shelf_life_days;
        const shelfLifeDays = estimatedDays !== undefined ? estimatedDays : null;

        // 1. Create a QualityInspection record for the image inspection
        let inspection = null;
        try {
            const uploadedPhotoPaths = req.files && Array.isArray(req.files)
                ? req.files.map((f) => f.path || f.filename).filter(Boolean)
                : [];

            inspection = await QualityInspection.create({
                batchId: batch._id,
                inspectionType: "IMAGE",
                visualQuality: {
                    score: cv.freshness_score,
                    color: cv.visual_class,
                    visibleDefects: cv.visual_class?.toLowerCase().includes("rotten") ? [cv.visual_class] : [],
                },
                physicalQuality: {
                    firmness: null,
                    surfaceCondition: cv.visual_class,
                },
                environmentalData: {
                    temperature: storage.temperatureC ?? null,
                    humidity: storage.humidityPercent ?? null,
                },
                imageUrl: uploadedPhotoPaths[0] || null,
                notes: `AI Vision classified as ${cv.visual_class} (freshness score: ${cv.freshness_score}/100, confidence: ${Math.round((cv.confidence || 0) * 100)}%)`,
            });
        } catch (qiError) {
            logger.warn("Failed to create QualityInspection for AI analysis:", qiError.message);
        }

        // 2. Create the Prediction record
        const spoilageProbability =
            shelfLife?.assessment?.spoilage_risk === "HIGH"
                ? 0.8
                : shelfLife?.assessment?.spoilage_risk === "MEDIUM"
                ? 0.5
                : shelfLife?.assessment?.spoilage_risk === "LOW"
                ? 0.15
                : 0.5;

        const prediction = await Prediction.create({
            batchId: batch._id,
            inspectionId: inspection?._id || null,
            freshnessScore: cv.freshness_score,
            shelfLifeDays,
            spoilageProbability,
            riskLevel: riskLevelFromDecision(shelfLife),
            confidence: shelfLife?.assessment?.confidence ?? cv.confidence,
            source: "ml_python_service",
            visualClass: cv.visual_class,
            classDistribution: cv.class_distribution,
            shelfLifeAssessment: shelfLife,
            decision,
            inputSignals: {
                visualScore: cv.freshness_score,
                temperature: storage.temperatureC ?? null,
                humidity: storage.humidityPercent ?? null,
                daysSinceHarvest: storage.harvestAgeDays ?? null,
                transportDurationHours: storage.transportDurationHours ?? null,
                storageType: storage.storageType ?? null,
            },
        });

        // 3. Create Recommendation record if decision recommendation is present
        try {
            const primaryAction = decision?.recommendation?.primary_action || "HOLD";
            const urgency = decision?.recommendation?.urgency || "LOW";
            const reason =
                decision?.reasoning ||
                `AI recommendation: ${primaryAction} based on visual freshness and shelf life assessment.`;

            let actionType = "HOLD";
            const actionUpper = primaryAction.toUpperCase();
            if (actionUpper.includes("SELL_LOCAL") || actionUpper.includes("LOCAL")) actionType = "SELL_LOCAL";
            else if (actionUpper.includes("MOVE") || actionUpper.includes("TRANSPORT")) actionType = "MOVE_TO_MARKET";
            else if (actionUpper.includes("DISCOUNT")) actionType = "DISCOUNT";
            else if (actionUpper.includes("PROCESS")) actionType = "PROCESS";
            else if (actionUpper.includes("REDIRECT")) actionType = "REDIRECT";
            else if (actionUpper.includes("URGENT")) actionType = "URGENT_SELL";

            let urgencyLevel = "LOW";
            const urgUpper = urgency.toUpperCase();
            if (urgUpper.includes("CRIT")) urgencyLevel = "CRITICAL";
            else if (urgUpper.includes("HIGH")) urgencyLevel = "HIGH";
            else if (urgUpper.includes("MED")) urgencyLevel = "MEDIUM";

            await Recommendation.create({
                batchId: batch._id,
                predictionId: prediction._id,
                actionType,
                urgencyLevel,
                reason,
                targetMarket: decision?.allocations?.[0]?.market || null,
                reasonFactors: {
                    shelfLifeDays: prediction.shelfLifeDays,
                    spoilageProbability: prediction.spoilageProbability,
                    freshnessScore: prediction.freshnessScore,
                    riskLevel: prediction.riskLevel,
                },
                confidence: prediction.confidence,
            });
        } catch (recError) {
            logger.warn("Failed to create Recommendation for AI analysis:", recError.message);
        }

        // 4. Update Batch prediction cache
        await updateBatchPredictionCache(batchId, {
            freshnessScore: cv.freshness_score,
            shelfLifeDays: shelfLifeDays ?? 0,
            spoilageProbability: prediction.spoilageProbability,
        });

        logger.info("[EXPRESS] response sent", {
            batchId,
            visualClass: cv.visual_class,
            primaryAction: decision?.recommendation?.primary_action,
        });

        return sendSuccess(res, 201, prediction, "Batch analyzed successfully");
    } catch (error) {
        if (error instanceof MLServiceError) {
            return sendError(res, error.statusCode, error.message, error.detail);
        }
        next(error);
    }
};

/**
 * POST /api/batches/:batchId/analyze/insights
 * GET  /api/predictions/:batchId/insights
 *
 * Optional "✨ Get AI Insights" step. Uses the most recent
 * prediction's shelf-life assessment to request an LLM explanation
 * of the decision, without re-running CV or the deterministic engine's numbers.
 */
export const getBatchInsightsController = async (req, res, next) => {
    try {
        const { batchId } = req.params;
        const batch = await getBatchById(batchId);
        if (!batch) return sendError(res, 404, "Batch not found");

        let latest = await Prediction.findOne({ batchId, source: "ml_python_service" }).sort({
            createdAt: -1,
        });

        if (!latest) {
            latest = await Prediction.findOne({ batchId }).sort({ createdAt: -1 });
        }

        if (!latest) {
            return sendError(
                res,
                422,
                "No analysis on file for this batch yet. Run Analyze Batch first."
            );
        }

        // If insights were already computed and no new inputs requested, return them directly
        if (req.method === "GET" && latest.aiInsights?.explanation && !req.query.refresh) {
            return sendSuccess(
                res,
                200,
                {
                    agent_explanation: latest.aiInsights.explanation,
                    agent_notes: latest.aiInsights.notes,
                    agent_provider: latest.aiInsights.provider,
                    agent_model: latest.aiInsights.model,
                },
                "AI insights retrieved"
            );
        }

        const markets = parseJSONField(req.body?.markets, []);
        const routes = parseJSONField(req.body?.routes, []);
        const localMarket = parseJSONField(req.body?.localMarket, null);

        const shelfLifeAssessment = latest.shelfLifeAssessment || {
            assessment: {
                estimated_remaining_shelf_life_days: latest.shelfLifeDays ?? 3,
                confidence: latest.confidence ?? 0.5,
                spoilage_risk: latest.riskLevel || "MEDIUM",
            },
            factors: {},
            reasoning: "Heuristic prediction baseline",
        };

        const insights = await getAgentInsights({
            batchId: batch._id.toString(),
            produce: batch.produceType,
            quantityKg: batch.quantity,
            shelfLifeAssessment,
            markets,
            routes,
            localMarket,
        });

        latest.aiInsights = {
            explanation: insights.agent_explanation,
            notes: insights.agent_notes,
            provider: insights.agent_provider,
            model: insights.agent_model,
            generatedAt: new Date(),
        };
        await latest.save();

        return sendSuccess(res, 200, insights, "AI insights generated");
    } catch (error) {
        if (error instanceof MLServiceError) {
            return sendError(res, error.statusCode, error.message, error.detail);
        }
        next(error);
    }
};
