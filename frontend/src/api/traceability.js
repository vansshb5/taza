import apiClient from "./client";
import { mockPassport } from "../data/mockData";

const USE_MOCK = false; // Live backend endpoint connected: GET /api/traceability/:batchId

export async function getBatchPassport(batchId) {
  if (USE_MOCK) return Promise.resolve({ ...mockPassport, batchId });
  try {
    const response = await apiClient.get(`/traceability/${batchId}`);
    const data = response.data?.data || response.data;
    if (!data) return { ...mockPassport, batchId };

    return {
      ...data,
      batchId: data.batchCode || data.batchId || batchId,
      produce: data.productName || data.produceType || "Produce",
      freshness: data.currentFreshness?.freshnessScore ?? data.freshness ?? 50,
      shelfLifeDays: data.currentFreshness?.shelfLifeDays ?? data.shelfLifeDays ?? 3,
      spoilageRisk: Math.round(
        (data.currentFreshness?.spoilageProbability != null
          ? data.currentFreshness.spoilageProbability
          : 0.2) * 100
      ),
      stages: data.supplyChainStages || data.stages || [],
      timeline: data.timeline || [],
    };
  } catch (error) {
    console.error("Failed to fetch batch passport from backend:", error);
    return { ...mockPassport, batchId };
  }
}
