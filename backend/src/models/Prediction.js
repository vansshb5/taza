import mongoose from "mongoose";

/**
 * Prediction — stores one freshness/shelf-life/spoilage estimate for a batch.
 *
 * A batch can have multiple prediction records over time (one per inspection).
 * The most recent one is what the dashboard and recommendation engine use.
 *
 * The `source` field clearly distinguishes heuristic estimates from real ML results.
 */
const predictionSchema = new mongoose.Schema(
    {
        batchId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Batch",
            required: true,
        },

        inspectionId: {
            // Optional — links to the QualityInspection that triggered this prediction
            type: mongoose.Schema.Types.ObjectId,
            ref: "QualityInspection",
            default: null,
        },

        // ── Core outputs ─────────────────────────────────────────────────────
        freshnessScore: {
            // 0–100. Higher = fresher.
            type: Number,
            required: true,
            min: 0,
            max: 100,
        },

        shelfLifeDays: {
            // Estimated commercially useful days remaining.
            type: Number,
            min: 0,
            default: null,
        },

        spoilageProbability: {
            // 0–1. Probability that the batch has meaningful spoilage.
            // null when the source only has an UNKNOWN risk category.
            type: Number,
            default: null,
            min: 0,
            max: 1,
        },

        riskLevel: {
            // Derived from spoilageProbability for human display.
            type: String,
            enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL", "UNKNOWN"],
            required: true,
        },

        // ── Confidence + source metadata ─────────────────────────────────────
        confidence: {
            // 0–1. How confident the model/heuristic is in this estimate.
            type: Number,
            min: 0,
            max: 1,
            default: null,
        },

        source: {
            // "heuristic_mock" | "ml_python_service" | "manual"
            type: String,
            required: true,
            default: "heuristic_mock",
        },

        // ── Input signals used for this prediction (for auditability) ────────
        inputSignals: {
            visualScore: { type: Number, default: null },
            firmness: { type: Number, default: null },
            temperature: { type: Number, default: null },
            humidity: { type: Number, default: null },
            daysSinceHarvest: { type: Number, default: null },
            storageDays: { type: Number, default: null },
            transportDurationHours: { type: Number, default: null },
            storageType: { type: String, default: null },
            storageLocation: { type: String, default: null },
            visibleDefects: { type: [String], default: [] },
            brix: { type: Number, default: null },
        },

        // ── Per-factor risk breakdown (for explainability) ───────────────────
        riskBreakdown: {
            visualDefectRisk: { type: Number, default: null },  // 0–1
            temperatureStressRisk: { type: Number, default: null },
            ageRisk: { type: Number, default: null },
            storageRisk: { type: Number, default: null },
        },

        notes: {
            type: String,
            trim: true,
            default: null,
        },

        // ── Full AI-service payload (Layer 1 CV + Layer 2 shelf-life + ─────────
        // Layer 3 decision engine), stored as-is when source is
        // "ml_python_service" so the dashboard can render the complete
        // action plan without re-deriving it. Optional/null for
        // "heuristic_mock" predictions.
        visualClass: {
            type: String,
            default: null,
        },

        classDistribution: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },

        shelfLifeAssessment: {
            // Full Layer 2 ShelfLifeAssessment (factors, evidence, reasoning, etc.)
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },

        decision: {
            // Full Layer 3 DecisionResult (recommendation, allocations, impact, etc.)
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },

        aiInsights: {
            // Populated lazily when the user clicks "Get AI Insights" —
            // { explanation, notes, provider, model, generatedAt }
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

predictionSchema.index({ batchId: 1, createdAt: -1 });

const Prediction = mongoose.model("Prediction", predictionSchema);

export default Prediction;
