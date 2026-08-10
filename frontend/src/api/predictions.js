import apiClient from "./client";

function unwrap(response) {
  return response.data?.data ?? response.data;
}

/**
 * GET /api/predictions/:batchId
 * Returns the latest stored prediction for a batch.
 *
 * Prediction document fields:
 *   freshnessScore, shelfLifeDays, spoilageProbability, riskLevel,
 *   confidence, source, inputSignals, riskBreakdown, notes,
 *   visualClass, classDistribution, shelfLifeAssessment, decision, aiInsights
 *
 * source = "ml_python_service" when produced via POST /api/batches/:batchId/analyze (full ML)
 * source = "heuristic_mock"    when produced via POST /api/predictions/:batchId/run (no images)
 */
export async function getLatestPrediction(batchId) {
  const response = await apiClient.get(`/predictions/${batchId}`);
  return unwrap(response);
}

/**
 * GET /api/predictions/:batchId/history
 * Returns array of all predictions for a batch.
 */
export async function getPredictionHistory(batchId, limit = 10) {
  const response = await apiClient.get(`/predictions/${batchId}/history`, {
    params: { limit },
  });
  return unwrap(response) ?? [];
}
