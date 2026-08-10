import { useState, useCallback } from "react";
import { createBatch } from "../api/batches";
import { analyzeBatch } from "../api/analysis";

/**
 * Multi-step inspection pipeline state machine.
 *
 * REAL PIPELINE:
 *  1. Create Batch   → POST /api/batches
 *  2. Analyze Batch  → POST /api/batches/:batchId/analyze  (multipart + images)
 *     This single call runs the full AI stack:
 *       Layer 1: CV freshness classification
 *       Layer 2: RAG shelf-life / spoilage assessment
 *       Layer 3: Deterministic decision engine
 *     Returns a Prediction document with:
 *       freshnessScore, shelfLifeDays, spoilageProbability, riskLevel,
 *       confidence, visualClass, classDistribution, shelfLifeAssessment, decision
 *
 * AI Insights (optional, separate):
 *   POST /api/batches/:batchId/analyze/insights  → handled in DecisionResultPanel
 *
 * No values are invented. Every displayed number comes from the API response.
 */

export const PIPELINE_STEPS = [
  { key: "batch",   label: "Creating batch…" },
  { key: "analyze", label: "Analyzing images, assessing shelf life & calculating best action…" },
];

const initialState = {
  status: "idle",          // idle | running | complete | error
  currentStep: null,       // key of the in-progress step
  completedSteps: [],
  failedStep: null,
  error: null,

  // Results (only from real API)
  batch: null,
  prediction: null,        // the Prediction doc returned by /analyze
};

export function useInspectionFlow() {
  const [state, setState] = useState(initialState);

  const reset = useCallback(() => setState(initialState), []);

  /**
   * Run the full pipeline.
   *
   * @param {object} batchPayload   — fields for POST /api/batches
   * @param {FileList|File[]} images — one or more image files (required for ML)
   * @param {object} [storageExtra] — optional extra form fields for /analyze
   *   { harvestAgeDays, temperatureC, humidityPercent,
   *     storageDurationHours, transportDurationHours, storageType }
   */
  const runPipeline = useCallback(async (batchPayload, images, storageExtra = {}) => {
    setState({ ...initialState, status: "running", currentStep: "batch" });

    // ── Step 1: Create Batch ───────────────────────────────────────────────
    let batch;
    try {
      batch = await createBatch(batchPayload);
      setState((s) => ({
        ...s,
        batch,
        completedSteps: [...s.completedSteps, "batch"],
        currentStep: "analyze",
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        status: "error",
        failedStep: "batch",
        error: err?.response?.data?.message ?? "Failed to create batch.",
      }));
      return;
    }

    const batchId = batch._id;

    // ── Step 2: Analyze Batch (full ML pipeline) ───────────────────────────
    // Build multipart FormData for POST /api/batches/:batchId/analyze
    const form = new FormData();

    // Attach images (field name "images" per upload.middleware.js)
    const imageList = Array.from(images ?? []);
    if (imageList.length === 0) {
      setState((s) => ({
        ...s,
        status: "error",
        failedStep: "analyze",
        error: "At least one produce image is required to run the AI analysis.",
      }));
      return;
    }
    imageList.forEach((file) => form.append("images", file));

    // Attach optional storage fields as strings
    const numericFields = [
      "harvestAgeDays",
      "temperatureC",
      "humidityPercent",
      "storageDurationHours",
      "transportDurationHours",
    ];
    numericFields.forEach((k) => {
      if (storageExtra[k] != null && storageExtra[k] !== "") {
        form.append(k, String(storageExtra[k]));
      }
    });
    if (storageExtra.storageType) form.append("storageType", storageExtra.storageType);

    let prediction;
    try {
      prediction = await analyzeBatch(batchId, form);
      setState((s) => ({
        ...s,
        prediction,
        completedSteps: [...s.completedSteps, "analyze"],
        currentStep: null,
        status: "complete",
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        status: "error",
        failedStep: "analyze",
        error:
          err?.response?.data?.message ??
          "Unable to analyze the uploaded images. Please check the AI service.",
      }));
    }
  }, []);

  return { state, runPipeline, reset };
}
