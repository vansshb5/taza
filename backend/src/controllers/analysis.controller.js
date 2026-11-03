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

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Error with an HTTP status that error.middleware.js / this controller can forward. */
const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

/**
 * Harvest age is ALWAYS derived from the batch's stored harvestDate at
 * analysis time. The frontend never sends it (any `daysSinceHarvest` /
 * `harvestAgeDays` form field is ignored on purpose).
 *
 * A harvest date a few hours "in the future" is a timezone artefact (a date
 * stored as UTC midnight, picked by a user whose local day started earlier),
 * so up to one day ahead is clamped to 0. Further ahead is real bad data.
 */
export const calculateHarvestAgeDays = (harvestDate) => {
    if (!harvestDate) {
        throw httpError(422, "Batch has no harvest date, so harvest age cannot be calculated.");
    }
    const harvestTime = new Date(harvestDate).getTime();
    if (!Number.isFinite(harvestTime)) {
        throw httpError(422, "Batch has an invalid harvest date.");
    }
    const ageMs = Date.now() - harvestTime;
    if (ageMs < -MS_PER_DAY) {
        throw httpError(422, "Batch harvest date is in the future; fix the harvest date before analyzing.");
    }
    return Math.max(0, ageMs) / MS_PER_DAY;
};

const parseJSONField = (raw, fieldName) => {
    if (raw === undefined || raw === null || raw === "") return fieldName === "localMarket" ? null : [];
    try {
        return typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
        throw httpError(422, `'${fieldName}' must be valid JSON.`);
    }
};

/**
 * Read an optional numeric body field, accepting either of two names.
 * Absent/blank -> undefined. Present but not a number -> 422 (never silently dropped).
 */
const readNumber = (body, primaryKey, aliasKey) => {
    const raw = body[primaryKey] ?? (aliasKey ? body[aliasKey] : undefined);
    if (raw === undefined || raw === null || raw === "") return undefined;
    const n = Number(raw);
    if (!Number.isFinite(n)) {
        throw httpError(422, `'${primaryKey}' must be a number.`);
    }
    return n;
};

// Python ActionType (SELL | DISCOUNT | REDISTRIBUTE | RESCUE) -> Recommendation.actionType.
//   SELL         = sell locally (optimizer: local market allocation)
//   REDISTRIBUTE = move to another market (optimizer: remote market allocation)
//   DISCOUNT     = discounted sale of the unallocated remainder
//   RESCUE       = batch unsafe/unsellable -> processing / feed / disposal route
const ACTION_TYPE_MAP = {
    SELL: "SELL_LOCAL",
    REDISTRIBUTE: "MOVE_TO_MARKET",
    DISCOUNT: "DISCOUNT",
    RESCUE: "PROCESS",
};
const URGENCY_LEVELS = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL", "UNKNOWN"]);

// Spoilage probability is NOT produced by the Python service (it returns a
// LOW/MEDIUM/HIGH category). Downstream waste/dashboard maths needs a number,
// so a coarse category-derived proxy is stored; UNKNOWN stays null. The UI
// must show the category, never this proxy as a measured percentage.
const SPOILAGE_PROXY = { LOW: 0.15, MEDIUM: 0.5, HIGH: 0.8 };

// One analysis per batch at a time (double-click / retry protection).
// In-memory: effective for a single Express process.
const analysesInFlight = new Set();

/**
 * POST /api/batches/:batchId/analyze
 * multipart/form-data: images (required, 1..8 files), plus optional storage fields.
 *
 * Accepts both the frontend's camelCase aliases AND the backend-canonical names:
 *   temperature / temperatureC
 *   humidity / humidityPercent
 *   transportDurationHours, storageDurationHours, storageType, storageLocation
 *   markets / routes / localMarket (each a JSON string)
 * Harvest age is NOT accepted from the client (see calculateHarvestAgeDays).
 */
export const analyzeBatchController = async (req, res, next) => {
    const { batchId } = req.params;
    let lockAcquired = false;
    const created = { inspection: null, prediction: null, recommendation: null };

    try {
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

        if (analysesInFlight.has(batchId)) {
            return sendError(res, 409, "An analysis is already running for this batch. Please wait for it to finish.");
        }
        analysesInFlight.add(batchId);
        lockAcquired = true;

        const storage = {
            harvestAgeDays: calculateHarvestAgeDays(batch.harvestDate),
            temperatureC:
                readNumber(req.body, "temperatureC", "temperature") ??
                (batch.storageTemperatureCelsius != null ? batch.storageTemperatureCelsius : undefined),
            humidityPercent:
                readNumber(req.body, "humidityPercent", "humidity") ??
                (batch.storageHumidityPercent != null ? batch.storageHumidityPercent : undefined),
            storageDurationHours: readNumber(req.body, "storageDurationHours"),
            transportDurationHours: readNumber(req.body, "transportDurationHours"),
            storageType: req.body.storageType || undefined,
            storageLocation: req.body.storageLocation || undefined,
        };

        const markets = parseJSONField(req.body.markets, "markets");
        const routes = parseJSONField(req.body.routes, "routes");
        const localMarket = parseJSONField(req.body.localMarket, "localMarket");

        logger.info("[EXPRESS] storage inputs resolved", { batchId, ...storage });

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

        const { cv_analysis: cv, shelf_life: shelfLife, decision } = result || {};
        if (!cv || !shelfLife?.assessment || !decision?.recommendation) {
            throw new MLServiceError(
                "AI service returned an incomplete analysis (missing cv_analysis, shelf_life or decision).",
                502
            );
        }

        const estimatedDays = shelfLife.assessment.estimated_remaining_shelf_life_days;
        const shelfLifeDays = estimatedDays ?? null;
        const spoilageRisk = shelfLife.assessment.spoilage_risk;
        const riskLevel = ["LOW", "MEDIUM", "HIGH"].includes(spoilageRisk) ? spoilageRisk : "UNKNOWN";
        const spoilageProbability = SPOILAGE_PROXY[riskLevel] ?? null;

        // 1. QualityInspection for the image inspection
        created.inspection = await QualityInspection.create({
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
            imageUrl: null, // images are streamed to the AI service and not persisted
            notes: `AI Vision classified as ${cv.visual_class} (freshness score: ${cv.freshness_score}/100, confidence: ${Math.round((cv.confidence || 0) * 100)}%)`,
        });

        // 2. Prediction
        created.prediction = await Prediction.create({
            batchId: batch._id,
            inspectionId: created.inspection._id,
            freshnessScore: cv.freshness_score,
            shelfLifeDays,
            spoilageProbability,
            riskLevel,
            confidence: shelfLife.assessment.confidence ?? cv.confidence,
            source: "ml_python_service",
            visualClass: cv.visual_class,
            classDistribution: cv.class_distribution,
            shelfLifeAssessment: shelfLife,
            decision,
            notes:
                "spoilageProbability is a category-derived proxy (LOW=0.15, MEDIUM=0.5, HIGH=0.8); " +
                "the AI service reports only the spoilage-risk category.",
            inputSignals: {
                visualScore: cv.freshness_score,
                temperature: storage.temperatureC ?? null,
                humidity: storage.humidityPercent ?? null,
                daysSinceHarvest: storage.harvestAgeDays,
                storageDays:
                    storage.storageDurationHours != null ? storage.storageDurationHours / 24 : null,
                transportDurationHours: storage.transportDurationHours ?? null,
                storageType: storage.storageType ?? null,
                storageLocation: storage.storageLocation ?? null,
            },
        });
        const prediction = created.prediction;

        // 3. Recommendation (mapped from the Python decision, never defaulted to HOLD)
        const primaryAction = decision.recommendation.primary_action;
        let actionType = ACTION_TYPE_MAP[primaryAction];
        // The engine headlines SELL when demand absorbs the whole batch, which
        // can include remote markets. Keep actionType consistent with the
        // targetMarket we store: a remote top allocation is a move, not a local sale.
        if (primaryAction === "SELL" && decision.allocations?.[0]?.action === "REDISTRIBUTE") {
            actionType = "MOVE_TO_MARKET";
        }
        if (!actionType) {
            throw new MLServiceError(`AI service returned an unknown primary_action '${primaryAction}'.`, 502);
        }
        const urgencyRaw = String(decision.recommendation.urgency || "UNKNOWN").toUpperCase();
        const urgencyLevel = URGENCY_LEVELS.has(urgencyRaw) ? urgencyRaw : "UNKNOWN";
        const topAllocation = decision.allocations?.[0];

        created.recommendation = await Recommendation.create({
            batchId: batch._id,
            predictionId: prediction._id,
            actionType,
            urgencyLevel,
            reason: decision.reasoning || `AI decision engine recommended ${primaryAction}.`,
            targetMarket: topAllocation?.destination ?? null,
            reasonFactors: {
                shelfLifeDays: prediction.shelfLifeDays,
                spoilageProbability: prediction.spoilageProbability,
                freshnessScore: prediction.freshnessScore,
                bestMarket: topAllocation?.destination ?? null,
                riskLevel: prediction.riskLevel,
            },
            expectedWasteKg: decision.impact?.expected_waste_kg ?? null,
            confidence: decision.recommendation.confidence ?? prediction.confidence,
        });

        // 4. Batch prediction cache (null stays null — never faked as 0 days)
        await updateBatchPredictionCache(batch._id, {
            freshnessScore: cv.freshness_score,
            shelfLifeDays,
            spoilageProbability,
        });

        logger.info("[EXPRESS] response sent", { batchId, visualClass: cv.visual_class, primaryAction });
        return sendSuccess(res, 201, prediction, "Batch analyzed successfully");
    } catch (error) {
        // Compensating rollback (no multi-document transaction: the default
        // standalone MongoDB does not support them). Children are deleted
        // before parents, and any failure to clean up is logged loudly with
        // the orphan ids rather than ignored.
        const cleanup = [
            ["Recommendation", Recommendation, created.recommendation],
            ["Prediction", Prediction, created.prediction],
            ["QualityInspection", QualityInspection, created.inspection],
        ].filter(([, , doc]) => doc);
        const outcomes = await Promise.allSettled(cleanup.map(([, Model, doc]) => Model.deleteOne({ _id: doc._id })));
        outcomes.forEach((o, i) => {
            if (o.status === "rejected") {
                logger.error("[EXPRESS] ROLLBACK FAILED — orphan record left behind", {
                    batchId,
                    model: cleanup[i][0],
                    id: String(cleanup[i][2]._id),
                    message: o.reason?.message,
                });
            }
        });
        if (error instanceof MLServiceError) {
            return sendError(res, error.statusCode, error.message, error.detail);
        }
        next(error);
    } finally {
        if (lockAcquired) analysesInFlight.delete(batchId);
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

        const markets = parseJSONField(req.body?.markets, "markets");
        const routes = parseJSONField(req.body?.routes, "routes");
        const localMarket = parseJSONField(req.body?.localMarket, "localMarket");

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
