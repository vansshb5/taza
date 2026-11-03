import apiClient from "./client";


// ============================================================
// HELPERS
// ============================================================

function unwrapResponse(response) {
  return (
    response?.data?.data ??
    response?.data ??
    null
  );
}


function normalizePercentage(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return null;
  }

  // Some APIs return probability as 0–1,
  // while the frontend displays percentage 0–100.
  if (
    number >= 0 &&
    number <= 1
  ) {
    return number * 100;
  }

  return number;
}


function normalizePrediction(data) {
  if (!data) {
    return null;
  }

  // Some backend responses wrap prediction
  // inside { prediction: {...} }.
  const prediction =
    data.prediction ??
    data.result ??
    data;


  const isMlResult =
    (prediction.source ?? prediction.model) === "ml_python_service";

  // The AI service reports spoilage risk only as a LOW/MEDIUM/HIGH category.
  // The backend stores a coarse category-derived proxy probability for
  // downstream maths; it is NOT a measured percentage, so for ML results the
  // numeric spoilageRisk stays null and the UI shows riskLevel instead.
  const spoilageRisk = isMlResult
    ? null
    : prediction.spoilageRisk ??
      prediction.spoilage_risk ??
      normalizePercentage(
        prediction.spoilageProbability ??
        prediction.spoilage_probability
      );


  // Real AI payloads (Layer 2 shelf-life assessment).
  const sla =
    prediction.shelfLifeAssessment ??
    prediction.shelf_life_assessment ??
    null;
  const slaAssessment = sla?.assessment ?? null;
  const rangeDays = Array.isArray(slaAssessment?.estimate_range_days)
    ? slaAssessment.estimate_range_days
    : null;


  // The backend stores the full DecisionResult (recommendation, allocations,
  // impact, unallocated, reasoning, constraints, missing_information).
  // Pass it through as-is — InspectProduce reads sub-fields directly.
  const decision =
    prediction.decision ??
    prediction.recommendation ??
    null;


  const inputSignals =
    prediction.inputSignals ??
    prediction.input_signals ??
    prediction.inputs ??
    {};


  return {
    // --------------------------------------------------------
    // Identity
    // --------------------------------------------------------

    id:
      prediction.id ??
      prediction._id ??
      prediction.predictionId,

    batchId:
      prediction.batchId ??
      prediction.batch_id,


    // --------------------------------------------------------
    // Visual / CV result
    // --------------------------------------------------------

    visualClass:
      prediction.visualClass ??
      prediction.visual_class ??
      prediction.className ??
      prediction.class_name ??
      prediction.predictedClass ??
      prediction.predicted_class ??
      null,

    freshness:
      prediction.freshness ??
      prediction.freshnessScore ??
      prediction.freshness_score ??
      null,


    // --------------------------------------------------------
    // Shelf life
    // --------------------------------------------------------

    shelfLifeDays:
      prediction.shelfLifeDays ??
      prediction.shelf_life_days ??
      prediction.predictedShelfLife ??
      prediction.predicted_shelf_life ??
      null,

    shelfLifeRange:
      prediction.shelfLifeRange ??
      prediction.shelf_life_range ??
      (rangeDays && rangeDays.length === 2
        ? { min: rangeDays[0], max: rangeDays[1] }
        : null),


    // --------------------------------------------------------
    // Spoilage
    // --------------------------------------------------------

    spoilageRisk,

    spoilageProbability:
      prediction.spoilageProbability ??
      prediction.spoilage_probability ??
      null,


    // --------------------------------------------------------
    // Risk / confidence
    // --------------------------------------------------------

    riskLevel:
      prediction.riskLevel ??
      prediction.risk_level ??
      (
        spoilageRisk == null
          ? null
          : spoilageRisk >= 70
          ? "HIGH"
          : spoilageRisk >= 35
          ? "MEDIUM"
          : "LOW"
      ),

    confidence:
      prediction.confidence ??
      prediction.modelConfidence ??
      prediction.model_confidence ??
      null,


    // --------------------------------------------------------
    // Condition / urgency
    // --------------------------------------------------------

    batchCondition:
      prediction.batchCondition ??
      prediction.batch_condition ??
      sla?.condition?.batch_condition ??
      null,

    // Visual inspection details from the saved assessment
    produce: sla?.produce ?? null,
    cvConfidence: sla?.condition?.cv_confidence ?? null,
    dataQuality: sla?.data_quality ?? null,
    missingInformation: Array.isArray(sla?.missing_information)
      ? sla.missing_information
      : [],

    urgency:
      prediction.urgency ??
      prediction.priority ??
      slaAssessment?.urgency ??
      null,


    // --------------------------------------------------------
    // Reasoning
    // --------------------------------------------------------

    reasoning:
      prediction.reasoning ??
      sla?.reasoning_summary ??
      prediction.explanation ??
      prediction.explanationText ??
      prediction.explanation_text ??
      null,


    // --------------------------------------------------------
    // Decision engine
    //
    // Pass the full DecisionResult through so the UI can render
    // recommendation, allocations, impact, unallocated, reasoning,
    // constraints and missing_information without re-deriving them.
    // The legacy scalar aliases are kept for backwards compatibility
    // with heuristic_mock predictions that only have decision.action.
    // --------------------------------------------------------

    decision: decision
      ? {
          // Pass everything through so the UI renders the full result.
          ...decision,

          // Backwards-compat scalar aliases kept for old heuristic_mock records.
          action:
            decision.recommendation?.primary_action ??
            decision.action ??
            decision.recommendedAction ??
            decision.recommended_action ??
            prediction.action ??
            null,

          reasoning:
            decision.reasoning ??
            decision.explanation ??
            prediction.decisionReasoning ??
            null,

          priority:
            decision.recommendation?.urgency ??
            decision.priority ??
            prediction.priority ??
            null,
        }
      : {
          action: prediction.action ?? prediction.recommendedAction ?? null,
          reasoning: prediction.decisionReasoning ?? null,
          priority: prediction.priority ?? null,
        },


    // --------------------------------------------------------
    // Impact
    // --------------------------------------------------------

    impact:
      prediction.impact ??
      prediction.estimatedImpact ??
      prediction.estimated_impact ??
      decision?.impact ??
      null,


    // --------------------------------------------------------
    // Factors
    // --------------------------------------------------------

    factors:
      Array.isArray(sla?.factors) && sla.factors.length > 0
        ? sla.factors.map((f) => ({
            ...f,
            // UI renders `reason`; the AI service calls it `explanation`.
            reason: f.reason ?? f.explanation ?? null,
          }))
        : Array.isArray(
        prediction.factors
      )
        ? prediction.factors
        : Array.isArray(
            prediction.riskFactors
          )
        ? prediction.riskFactors
        : [],


    // --------------------------------------------------------
    // RAG evidence
    // --------------------------------------------------------

    evidence:
      Array.isArray(sla?.evidence) && sla.evidence.length > 0
        ? sla.evidence.map((e) =>
            typeof e === "string"
              ? e
              : {
                  ...e,
                  text: [
                    e.title && (e.source ? `${e.title} (${e.source})` : e.title),
                    e.key_information,
                  ]
                    .filter(Boolean)
                    .join(" — "),
                }
          )
        : Array.isArray(
        prediction.evidence
      )
        ? prediction.evidence
        : Array.isArray(
            prediction.sources
          )
        ? prediction.sources
        : [],


    // --------------------------------------------------------
    // CV class distribution (Layer 1)
    // --------------------------------------------------------

    classDistribution:
      prediction.classDistribution ??
      prediction.class_distribution ??
      null,


    // --------------------------------------------------------
    // Full shelf-life assessment (Layer 2)
    // --------------------------------------------------------

    shelfLifeAssessment:
      prediction.shelfLifeAssessment ??
      prediction.shelf_life_assessment ??
      null,


    // --------------------------------------------------------
    // Allocation / redistribution
    // --------------------------------------------------------

    allocations:
      Array.isArray(decision?.allocations)
        ? decision.allocations
        : Array.isArray(
        prediction.allocations
      )
        ? prediction.allocations
        : Array.isArray(
            prediction.recommendedAllocations
          )
        ? prediction.recommendedAllocations
        : [],


    // --------------------------------------------------------
    // Input signals
    // --------------------------------------------------------

    inputSignals: {
      temperature:
        inputSignals.temperature ??
        inputSignals.temperatureC ??
        inputSignals.temperature_c ??
        null,

      humidity:
        inputSignals.humidity ??
        inputSignals.humidityPercent ??
        inputSignals.humidity_percent ??
        null,

      daysSinceHarvest:
        inputSignals.daysSinceHarvest ??
        inputSignals.days_since_harvest ??
        null,

      transportDurationHours:
        inputSignals.transportDurationHours ??
        inputSignals.transport_duration_hours ??
        null,

      storageType:
        inputSignals.storageType ??
        inputSignals.storage_type ??
        null,

      storageLocation:
        inputSignals.storageLocation ??
        inputSignals.storage_location ??
        null,
    },


    // --------------------------------------------------------
    // Metadata
    // --------------------------------------------------------

    source:
      prediction.source ??
      prediction.model ??
      null,

    createdAt:
      prediction.createdAt ??
      prediction.created_at ??
      null,

    updatedAt:
      prediction.updatedAt ??
      prediction.updated_at ??
      null,


    // Keep original response available.
    _raw: prediction,
  };
}


// ============================================================
// ANALYZE BATCH IMAGES
// ============================================================
//
// This function sends the images + batch conditions to the
// EXISTING AI/backend pipeline.
//
// The AI service itself is NOT changed.
//
// Expected frontend flow:
//
// Analyze page
//      ↓
// runInspection()
//      ↓
// analyzeBatchImages()
//      ↓
// POST /api/batches/:batchId/analyze
//      ↓
// Existing backend / AI service
//      ↓
// Prediction
// ============================================================

export async function analyzeBatchImages(
  batchId,
  files,
  input = {}
) {
  if (!batchId) {
    throw new Error(
      "Batch ID is required."
    );
  }


  if (
    !files ||
    files.length === 0
  ) {
    throw new Error(
      "At least one produce image is required."
    );
  }


  const formData =
    new FormData();


  // ----------------------------------------------------------
  // Images
  //
  // Use "images" as the primary field.
  // The backend can receive multiple images.
  // ----------------------------------------------------------

  files.forEach((file) => {
    if (file) {
      formData.append(
        "images",
        file
      );
    }
  });


  // ----------------------------------------------------------
  // Additional AI inputs
  //
  // Only append values that actually exist.
  // This prevents empty frontend fields from overwriting
  // backend defaults.
  // ----------------------------------------------------------

  const appendIfPresent = (
    key,
    value
  ) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      formData.append(
        key,
        String(value)
      );
    }
  };


  appendIfPresent(
    "temperature",
    input.temperature
  );

  appendIfPresent(
    "humidity",
    input.humidity
  );

  appendIfPresent(
    "storageType",
    input.storageType
  );

  appendIfPresent(
    "storageLocation",
    input.storageLocation
  );

  appendIfPresent(
    "transportDurationHours",
    input.transportDurationHours
  );

  // NOTE: harvest age is intentionally NOT sent. The backend derives it from
  // the batch's stored harvestDate at analysis time (single source of truth).


  // ----------------------------------------------------------
  // Real market demand + route data (optional)
  //
  // The backend (analysis.controller.js) reads these as JSON-encoded
  // form fields and forwards them, unmodified, into the Python
  // DecisionRequest's markets / routes / local_market. Only sent when
  // non-empty — an absent field means "no market data for this run",
  // never a fabricated default.
  // ----------------------------------------------------------

  if (Array.isArray(input.markets) && input.markets.length > 0) {
    formData.append("markets", JSON.stringify(input.markets));
  }

  if (Array.isArray(input.routes) && input.routes.length > 0) {
    formData.append("routes", JSON.stringify(input.routes));
  }

  if (input.localMarket) {
    formData.append("localMarket", JSON.stringify(input.localMarket));
  }


  // ----------------------------------------------------------
  // Send request
  // ----------------------------------------------------------

  // IMPORTANT — Content-Type for this request must be explicitly UNSET,
  // not omitted and not set to a literal "multipart/form-data" string.
  //
  //  - Omitting it (as a previous version of this file did) means axios
  //    falls back to apiClient's INSTANCE default, "application/json"
  //    (see api/client.js). Axios's own rule for FormData bodies is: if
  //    the effective Content-Type says JSON, silently JSON.stringify the
  //    FormData instead of sending it as multipart. That's what caused
  //    "images"/"temperature"/etc to show up as plain JSON body keys on
  //    the server, and req.files to always be empty.
  //  - Setting it to a bare "multipart/form-data" string (an even earlier
  //    version) avoids the JSON path, but ships with no boundary
  //    parameter, which some environments won't fix up for you either.
  //
  // Setting it to `undefined` here removes the JSON default for just this
  // call, so axios detects the FormData body itself and lets the browser
  // attach the correct "multipart/form-data; boundary=..." header.
  const response =
    await apiClient.post(
      `/batches/${batchId}/analyze`,
      formData,
      {
        headers: {
          "Content-Type": undefined,
        },
      }
    );


  const data =
    unwrapResponse(
      response
    );


  return normalizePrediction(
    data
  );
}


// ============================================================
// GET LATEST PREDICTION
// ============================================================
//
// Backend:
// GET /api/predictions/:batchId
//
// Used by BatchDetails.jsx.
// ============================================================

export async function getLatestPrediction(
  batchId
) {
  if (!batchId) {
    throw new Error(
      "Batch ID is required."
    );
  }


  const response =
    await apiClient.get(
      `/predictions/${batchId}`
    );


  const data =
    unwrapResponse(
      response
    );


  // Backend may return:
//
// {
//   prediction: {...}
// }
//
// or directly:
//
// {
//   freshness: 82,
//   ...
// }

  return normalizePrediction(
    data
  );
}


// ============================================================
// GET PREDICTION HISTORY
// ============================================================
//
// Kept separate from latest prediction so the frontend can
// later display historical model runs without changing the
// analysis flow.
// ============================================================

export async function getPredictionHistory(
  batchId
) {
  if (!batchId) {
    throw new Error(
      "Batch ID is required."
    );
  }


  const response =
    await apiClient.get(
      `/predictions/${batchId}/history`
    );


  const data =
    unwrapResponse(
      response
    );


  const predictions =
    Array.isArray(data)
      ? data
      : Array.isArray(
          data?.predictions
        )
      ? data.predictions
      : [];


  return predictions.map(
    normalizePrediction
  );
}


// ============================================================
// AI INSIGHTS
// ============================================================
//
// Optional explanation endpoint.
//
// If your backend exposes this endpoint, the frontend can
// request a natural-language explanation after prediction.
//
// This does NOT replace the actual ML prediction.
// ============================================================

export async function getBatchAiInsights(
  batchId
) {
  if (!batchId) {
    throw new Error(
      "Batch ID is required."
    );
  }


  const response =
    await apiClient.get(
      `/predictions/${batchId}/insights`
    );


  return unwrapResponse(
    response
  );
}


// ============================================================
// EXPORT
// ============================================================

export {
  normalizePrediction,
};