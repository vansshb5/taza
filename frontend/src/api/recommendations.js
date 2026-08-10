import apiClient from "./client";

function unwrap(response) {
  return response.data?.data ?? response.data;
}

/**
 * POST /api/recommendations/:batchId/generate
 * Runs the decision engine for a batch.
 * Requires: a prediction must already exist (POST /api/predictions/:batchId/run first).
 * Returns: Recommendation { actionType, urgencyLevel, reason, reasonFactors,
 *                           expectedRevenue, expectedProfit, expectedWastePercent, expectedWasteKg,
 *                           confidence, targetMarket, targetLocation }
 */
export async function generateRecommendation(batchId) {
  const response = await apiClient.post(`/recommendations/${batchId}/generate`);
  return unwrap(response);
}

/**
 * GET /api/recommendations/:batchId
 * Returns the latest recommendation for a batch.
 */
export async function getLatestRecommendation(batchId) {
  const response = await apiClient.get(`/recommendations/${batchId}`);
  return unwrap(response);
}

/**
 * GET /api/recommendations/:batchId/history
 */
export async function getRecommendationHistory(batchId, limit = 10) {
  const response = await apiClient.get(`/recommendations/${batchId}/history`, {
    params: { limit },
  });
  return unwrap(response) ?? [];
}
