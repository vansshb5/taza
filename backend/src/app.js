import express from "express";
import cors from "cors";

// Routes
import authRoutes from "./routes/auth.routes.js";
import batchRoutes from "./routes/batch.routes.js";
import qualityInspectionRoutes from "./routes/qualityInspection.routes.js";
import analysisRoutes from "./routes/analysis.routes.js";
import predictionRoutes from "./routes/prediction.routes.js";
import marketRoutes from "./routes/market.routes.js";
import marketDemandRoutes from "./routes/marketDemand.routes.js";
import profitRoutes from "./routes/profit.routes.js";
import recommendationRoutes from "./routes/recommendation.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import traceabilityRoutes from "./routes/traceability.routes.js";

// Middleware
import errorMiddleware from "./middleware/error.middleware.js";

const app = express();

// ── Core middleware ──────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Taza backend is running",
        timestamp: new Date().toISOString(),
    });
});

// ── API routes ───────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/auth", authRoutes);
app.use("/api/batches", batchRoutes);
app.use("/api/batches", qualityInspectionRoutes); // nested: /api/batches/:batchId/inspections
app.use("/api/batches", analysisRoutes); // nested: /api/batches/:batchId/analyze[/insights]
app.use("/api/predictions", predictionRoutes);
app.use("/api/market", marketRoutes);
app.use("/api/batches", marketDemandRoutes); // nested: /api/batches/:batchId/market-data, /:batchId/decision
app.use("/api/profit", profitRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/traceability", traceabilityRoutes);

// ── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.path} not found`,
    });
});

// ── Centralised error handler (must be last) ─────────────────────────────────
app.use(errorMiddleware);

export default app;
