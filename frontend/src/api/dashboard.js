import apiClient from "./client";

function unwrap(response) {
  return response.data?.data ?? response.data;
}

/**
 * GET /api/dashboard/overview
 * Returns: { wasteMetrics, inventoryByStatus, recentRecommendations }
 */
export async function getDashboardOverview() {
  const response = await apiClient.get("/dashboard/overview");
  return unwrap(response);
}

/**
 * GET /api/dashboard/urgent
 * Returns: Batch[] sorted by urgency (lowest shelf life first)
 */
export async function getUrgentBatches() {
  const response = await apiClient.get("/dashboard/urgent");
  return unwrap(response) ?? [];
}
