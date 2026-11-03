import apiClient from "./client";


// ============================================================
// ACTION LABELS
// ============================================================

const ACTION_LABELS = {
  // AI decision-engine actions
  SELL: "Sell locally",
  DISCOUNT: "Discount now",
  REDISTRIBUTE: "Ship to high-demand location",
  RESCUE: "Redirect to processing",
  // Stored Recommendation.actionType values
  SELL_LOCAL: "Sell locally",
  MOVE_TO_MARKET: "Ship to high-demand location",
  PROCESS: "Redirect to processing",
  REDIRECT: "Redirect to alternative channel",
  URGENT_SELL: "Urgent sell immediately",
  HOLD: "Hold & monitor",
};


// ============================================================
// HELPERS
// ============================================================

function capitalize(value) {
  if (!value) return "Unknown";

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}


function getRiskLevel(probability) {
  if (probability == null) {
    return "UNKNOWN";
  }

  if (probability >= 0.5) {
    return "HIGH";
  }

  if (probability >= 0.2) {
    return "MEDIUM";
  }

  return "LOW";
}


function getConfidence(value) {
  if (value == null) {
    return "Unknown";
  }

  if (value >= 0.75) {
    return "High";
  }

  if (value >= 0.5) {
    return "Medium";
  }

  return "Low";
}


// ============================================================
// MAP URGENT BATCH
// ============================================================
//
// /dashboard/urgent returns raw batch-like objects.
// Convert them into the same shape used by the frontend.
// ============================================================

function mapUrgentBatch(batch) {
  const spoilageProbability =
    batch.spoilageProbability ?? null;

  return {
    id:
      batch.batchId ??
      batch._id ??
      batch.id,

    batchCode:
      batch.batchCode ?? null,

    produce:
      capitalize(
        batch.produceType ??
        batch.productName
      ),

    productName:
      batch.productName ??
      capitalize(batch.produceType),

    quantityKg:
      batch.quantity ?? 0,

    unit:
      batch.unit ?? "kg",

    location:
      batch.currentLocation ?? "Unknown",

    freshness:
      batch.freshnessScore ?? null,

    shelfLifeDays:
      batch.shelfLifeDays ?? null,

    spoilageRisk:
      spoilageProbability != null
        ? Math.round(
            spoilageProbability * 100
          )
        : null,

    riskLevel:
      getRiskLevel(
        spoilageProbability
      ),

    lastPredictedAt:
      batch.lastPredictedAt ?? null,

    confidence:
      getConfidence(
        batch.confidence
      ),

    action:
      ACTION_LABELS[
        batch.actionType
      ] ||
      ACTION_LABELS[
        batch.primaryAction
      ] ||
      "Analyze batch",

    _raw:
      batch,
  };
}


// ============================================================
// MAP DASHBOARD OVERVIEW
// ============================================================

function mapOverview(data) {
  const wasteMetrics =
    data?.wasteMetrics || {};

  const inventoryByStatus =
    data?.inventoryByStatus || {};

  const recentRecommendations =
    data?.recentRecommendations || {};

  return {
    // --------------------------------------------------------
    // Inventory
    // --------------------------------------------------------

    totalBatches:
      wasteMetrics.totalBatches ?? 0,

    totalInventoryKg:
      wasteMetrics.totalInventoryKg ?? 0,

    batchesWithPredictions:
      wasteMetrics.batchesWithPredictions ??
      0,

    batchesWithoutPredictions:
      wasteMetrics.batchesWithoutPredictions ??
      0,


    // --------------------------------------------------------
    // Risk
    // --------------------------------------------------------

    atRiskBatchCount:
      wasteMetrics.atRiskBatchCount ?? 0,

    atRiskInventoryKg:
      wasteMetrics.atRiskInventoryKg ?? 0,

    criticalBatchCount:
      wasteMetrics.criticalBatchCount ?? 0,


    // --------------------------------------------------------
    // Spoilage
    // --------------------------------------------------------

    estimatedSpoilageKg:
      wasteMetrics.estimatedSpoilageKg ?? 0,

    estimatedSpoilagePercent:
      wasteMetrics.estimatedSpoilagePercent ?? 0,

    estimatedValueAtRisk:
      wasteMetrics.estimatedValueAtRisk ?? null,


    // --------------------------------------------------------
    // Prediction coverage
    // --------------------------------------------------------

    predictionCoverage:
      wasteMetrics.totalBatches > 0
        ? Math.round(
            (wasteMetrics.batchesWithPredictions /
              wasteMetrics.totalBatches) *
              100
          )
        : 0,


    // --------------------------------------------------------
    // Immediate actions
    // --------------------------------------------------------

    immediateActions:
      (
        wasteMetrics
          .batchesRequiringImmediateAction ||
        []
      ).map(mapUrgentBatch),


    // --------------------------------------------------------
    // Inventory status
    // --------------------------------------------------------

    inventoryByStatus,


    // --------------------------------------------------------
    // Recent decision activity
    // --------------------------------------------------------

    recentRecommendations,


    // --------------------------------------------------------
    // Backend warnings / uncertainty
    // --------------------------------------------------------

    disclaimer:
      wasteMetrics.disclaimer ??
      null,

    isPartial:
      Boolean(
        wasteMetrics.isPartial
      ),

    partialNote:
      wasteMetrics.partialNote ??
      null,
  };
}


// ============================================================
// GET DASHBOARD OVERVIEW
// ============================================================
//
// Backend:
// GET /api/dashboard/overview
//
// Response:
// {
//   success: true,
//   data: {
//     wasteMetrics,
//     inventoryByStatus,
//     recentRecommendations
//   }
// }
// ============================================================

export async function getDashboardOverview() {
  const { data } =
    await apiClient.get(
      "/dashboard/overview"
    );

  return mapOverview(
    data?.data ?? data
  );
}


// ============================================================
// GET URGENT BATCHES
// ============================================================
//
// Backend:
// GET /api/dashboard/urgent
// ============================================================

export async function getUrgentBatches() {
  const { data } =
    await apiClient.get(
      "/dashboard/urgent"
    );

  const batches =
    data?.data ?? data ?? [];

  if (!Array.isArray(batches)) {
    return [];
  }

  return batches.map(
    mapUrgentBatch
  );
}


// ============================================================
// BACKWARD-COMPATIBLE HELPERS
// ============================================================
//
// These keep old dashboard imports from immediately breaking.
// The redesigned Dashboard will use getDashboardOverview()
// directly.
// ============================================================

export async function getDashboardSummary() {
  const overview =
    await getDashboardOverview();

  return overview;
}


export async function getRiskBreakdown() {
  const overview =
    await getDashboardOverview();

  const {
    atRiskBatchCount,
    criticalBatchCount,
    totalBatches,
    batchesWithPredictions,
  } = overview;

  const safeCount = Math.max(
    0,
    batchesWithPredictions -
      atRiskBatchCount
  );

  return [
    {
      label: "Low risk",
      value: safeCount,
    },
    {
      label: "Medium risk",
      value: Math.max(
        0,
        atRiskBatchCount -
          criticalBatchCount
      ),
    },
    {
      label: "High risk",
      value: criticalBatchCount,
    },
    {
      label: "No prediction",
      value: Math.max(
        0,
        totalBatches -
          batchesWithPredictions
      ),
    },
  ];
}


export async function getRecentActivity() {
  const overview =
    await getDashboardOverview();

  return Object.entries(
    overview.recentRecommendations ||
      {}
  ).map(
    ([actionType, count]) => ({
      actionType,
      action:
        ACTION_LABELS[actionType] ||
        actionType,
      count,
    })
  );
}


// ============================================================
// LEGACY FUNCTIONS
// ============================================================
//
// The old UI displayed freshness/waste charts based on mock
// time-series data.
//
// Your real backend currently does NOT expose these endpoints.
//
// Returning empty arrays prevents the old components from
// showing fake ML data.
// ============================================================

export async function getFreshnessTrend() {
  return [];
}


export async function getWasteComparison() {
  return [];
}


// ============================================================
// EXPORT MAPPERS FOR FUTURE COMPONENTS
// ============================================================

export {
  mapOverview,
  mapUrgentBatch,
};