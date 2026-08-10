import apiClient from "./client";

function unwrap(response) {
  return response.data?.data ?? response.data;
}

/**
 * POST /api/batches/:batchId/analyze  (multipart/form-data)
 *
 * This is the FULL AI pipeline endpoint:
 *   Layer 1 — CV freshness classification
 *   Layer 2 — RAG shelf-life / spoilage assessment
 *   Layer 3 — Deterministic decision engine
 *
 * Required:
 *   - images: File[] (field name "images", 1–8 images)
 *   - batchId in the URL
 *
 * Optional form fields (all strings / JSON strings):
 *   harvestAgeDays, temperatureC, humidityPercent,
 *   storageDurationHours, transportDurationHours, storageType,
 *   markets (JSON), routes (JSON), localMarket (JSON)
 *
 * Returns: Prediction document with cv_analysis, shelf_life, decision stored
 */
export async function analyzeBatch(batchId, formData) {
  const response = await apiClient.post(
    `/batches/${batchId}/analyze`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return unwrap(response);
}

/**
 * POST /api/batches/:batchId/analyze/insights
 *
 * Optional "Get AI Insights" step. Requires a prior ml_python_service
 * prediction. Uses the stored shelf-life assessment + LLM to produce
 * a natural-language explanation. Numeric results stay unchanged.
 *
 * Returns: { agent_explanation, agent_notes, agent_provider, agent_model }
 */
export async function getBatchInsights(batchId, payload = {}) {
  const response = await apiClient.post(
    `/batches/${batchId}/analyze/insights`,
    payload
  );
  return unwrap(response);
}
