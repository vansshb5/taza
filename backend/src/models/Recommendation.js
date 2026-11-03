import mongoose from "mongoose";

/**
 * Recommendation — the decision output for a batch at a point in time.
 *
 * Action types:
 *   SELL_LOCAL    — sell immediately in current location
 *   MOVE_TO_MARKET — transport to a specific better-priced market
 *   DISCOUNT       — sell at reduced price to move inventory fast
 *   PROCESS        — convert to processed/value-added form (juice, dried, etc.)
 *   REDIRECT       — redirect to alternative buyer / donation channel
 *   HOLD           — no action needed yet, monitor
 *   URGENT_SELL    — extremely short shelf life, sell now at any price
 */
const recommendationSchema = new mongoose.Schema(
    {
        batchId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Batch",
            required: true,
        },

        predictionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Prediction",
            default: null,
        },

        profitAnalysisId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ProfitAnalysis",
            default: null,
        },

        // ── Decision ─────────────────────────────────────────────────────────
        actionType: {
            type: String,
            enum: [
                "SELL_LOCAL",
                "MOVE_TO_MARKET",
                "DISCOUNT",
                "PROCESS",
                "REDIRECT",
                "HOLD",
                "URGENT_SELL",
            ],
            required: true,
        },

        targetMarket: {
            // Populated for MOVE_TO_MARKET
            type: String,
            default: null,
        },

        targetLocation: {
            type: String,
            default: null,
        },

        urgencyLevel: {
            // Drives display priority in the dashboard
            type: String,
            enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL", "UNKNOWN"],
            required: true,
        },

        // ── Reasoning ────────────────────────────────────────────────────────
        reason: {
            // Human-readable explanation of WHY this action was recommended
            type: String,
            required: true,
        },

        reasonFactors: {
            // Structured version of the reasoning for programmatic use
            shelfLifeDays: Number,
            spoilageProbability: Number,
            freshnessScore: Number,
            bestMarket: String,
            expectedProfit: { type: Number, default: null },
            riskLevel: String,
        },

        // ── Expected impact ──────────────────────────────────────────────────
        expectedRevenue: { type: Number, default: null },
        expectedProfit: { type: Number, default: null },
        expectedWastePercent: { type: Number, default: null },
        expectedWasteKg: { type: Number, default: null },

        // ── Confidence ───────────────────────────────────────────────────────
        confidence: {
            type: Number,
            min: 0,
            max: 1,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

recommendationSchema.index({ batchId: 1, createdAt: -1 });

const Recommendation = mongoose.model("Recommendation", recommendationSchema);

export default Recommendation;
