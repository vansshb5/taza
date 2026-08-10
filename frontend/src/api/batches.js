import apiClient from "./client";

function unwrap(response) {
  // All Express responses: { success: true, data: <payload>, meta?: ... }
  return response.data?.data ?? response.data;
}

/**
 * GET /api/batches
 * Returns Batch[] from MongoDB.
 * Supports query params: produceType, status, currentLocation, page, limit, sortBy, sortOrder
 */
export async function getBatches(params = {}) {
  const response = await apiClient.get("/batches", { params });
  return unwrap(response) ?? [];
}

/**
 * GET /api/batches/:id
 * Returns a single Batch document.
 */
export async function getBatchById(id) {
  const response = await apiClient.get(`/batches/${id}`);
  return unwrap(response);
}

/**
 * POST /api/batches
 * Creates a new batch.
 * Required fields: productName, produceType, quantity, origin, harvestDate, arrivalDate, currentLocation
 */
export async function createBatch(payload) {
  const response = await apiClient.post("/batches", payload);
  return unwrap(response);
}

/**
 * PUT /api/batches/:id
 * Updates a batch.
 */
export async function updateBatch(id, payload) {
  const response = await apiClient.put(`/batches/${id}`, payload);
  return unwrap(response);
}

/**
 * DELETE /api/batches/:id
 */
export async function deleteBatch(id) {
  const response = await apiClient.delete(`/batches/${id}`);
  return unwrap(response);
}
