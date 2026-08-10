import apiClient from "./client";

function unwrap(response) {
  return response.data?.data ?? response.data;
}

/**
 * POST /api/batches/:batchId/inspections
 * Creates a quality inspection record for a batch.
 * Required body: { inspectionType: "MANUAL" | "IMAGE" | "SENSOR" }
 * Optional: visualQuality, physicalQuality, environmentalData, imageUrl, notes
 */
export async function createInspection(batchId, payload) {
  const response = await apiClient.post(
    `/batches/${batchId}/inspections`,
    payload
  );
  return unwrap(response);
}

/**
 * GET /api/batches/:batchId/inspections
 * Returns all inspections for a batch.
 */
export async function getInspections(batchId) {
  const response = await apiClient.get(`/batches/${batchId}/inspections`);
  return unwrap(response) ?? [];
}

/**
 * GET /api/batches/:batchId/inspections/:inspectionId
 */
export async function getInspectionById(batchId, inspectionId) {
  const response = await apiClient.get(
    `/batches/${batchId}/inspections/${inspectionId}`
  );
  return unwrap(response);
}

/**
 * DELETE /api/batches/:batchId/inspections/:inspectionId
 */
export async function deleteInspection(batchId, inspectionId) {
  const response = await apiClient.delete(
    `/batches/${batchId}/inspections/${inspectionId}`
  );
  return unwrap(response);
}
