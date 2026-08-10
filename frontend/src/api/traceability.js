import apiClient from "./client";

function unwrap(response) {
  return response.data?.data ?? response.data;
}

/**
 * GET /api/traceability/:batchId
 * Returns the full supply-chain passport for a batch.
 */
export async function getBatchPassport(batchId) {
  const response = await apiClient.get(`/traceability/${batchId}`);
  return unwrap(response);
}
