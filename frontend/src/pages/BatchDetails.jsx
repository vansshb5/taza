import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Droplets,
  Image as ImageIcon,
  MapPin,
  Package,
  ScanLine,
  Sparkles,
  Thermometer,
  Truck,
  Warehouse,
} from "lucide-react";
import { motion } from "framer-motion";

import PageContainer from "../components/layout/PageContainer";
import Card, {
  CardHeader,
} from "../components/ui/Card";
import Button from "../components/ui/Button";
import Loader from "../components/ui/Loader";
import EmptyState from "../components/ui/EmptyState";
import FreshnessRing from "../components/ui/FreshnessRing";

import {
  getBatchById,
} from "../api/batches";

import {
  getLatestPrediction,
} from "../api/predictions";


// ============================================================
// HELPERS
// ============================================================

function formatNumber(
  value,
  decimals = 0
) {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(Number(value))
  ) {
    return "—";
  }

  return Number(value).toLocaleString(
    "en-IN",
    {
      maximumFractionDigits:
        decimals,
    }
  );
}


function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
}


function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return date.toLocaleString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}


function riskLevelFromPercentage(
  percentage
) {
  if (percentage == null) {
    return "UNKNOWN";
  }

  if (percentage >= 70) {
    return "HIGH";
  }

  if (percentage >= 35) {
    return "MEDIUM";
  }

  return "LOW";
}


function riskClasses(level) {
  switch (
    String(level || "").toUpperCase()
  ) {
    case "HIGH":
    case "CRITICAL":
      return {
        badge:
          "bg-red-50 text-red-700 border-red-100",
        dot: "bg-red-500",
      };

    case "MEDIUM":
      return {
        badge:
          "bg-yellow-50 text-yellow-700 border-yellow-100",
        dot: "bg-yellow-500",
      };

    case "LOW":
      return {
        badge:
          "bg-green-50 text-green-700 border-green-100",
        dot: "bg-green-500",
      };

    default:
      return {
        badge:
          "bg-bg text-muted border-border",
        dot: "bg-gray-400",
      };
  }
}


function formatFactorName(
  value
) {
  if (!value) {
    return "";
  }

  return String(value)
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}


function formatRange(range) {
  if (!range) {
    return "—";
  }

  if (
    typeof range === "string"
  ) {
    return range;
  }

  if (
    typeof range === "object"
  ) {
    const min =
      range.min ??
      range.minimum ??
      range.low;

    const max =
      range.max ??
      range.maximum ??
      range.high;

    if (
      min != null &&
      max != null
    ) {
      return `${min}–${max} days`;
    }
  }

  return "—";
}


// ============================================================
// INFO ITEM
// ============================================================

function InfoItem({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <Icon size={12} />
        {label}
      </div>

      <p className="text-sm font-medium text-ink mt-1">
        {value || "—"}
      </p>
    </div>
  );
}


// ============================================================
// METRIC
// ============================================================

function Metric({
  icon: Icon,
  label,
  value,
  suffix,
}) {
  return (
    <div className="rounded-xl border border-border p-4">

      <div className="flex items-center gap-2 text-xs text-muted">
        <div className="w-7 h-7 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center">
          <Icon size={14} />
        </div>

        {label}
      </div>

      <p className="text-2xl font-semibold font-mono text-ink mt-3">
        {value ?? "—"}

        {suffix && (
          <span className="text-sm font-normal text-muted ml-1">
            {suffix}
          </span>
        )}
      </p>

    </div>
  );
}


// ============================================================
// RISK BADGE
// ============================================================

function RiskBadge({
  level,
}) {
  const classes =
    riskClasses(level);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${classes.badge}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${classes.dot}`}
      />

      {String(
        level || "UNKNOWN"
      ).toUpperCase()}
    </span>
  );
}


// ============================================================
// BATCH DETAILS
// ============================================================

export default function BatchDetails() {
  const { id } =
    useParams();

  const [batch, setBatch] =
    useState(null);

  const [prediction, setPrediction] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [predictionLoading, setPredictionLoading] =
    useState(true);

  const [error, setError] =
    useState(null);

  const [predictionError, setPredictionError] =
    useState(null);


  // ==========================================================
  // LOAD BATCH + PREDICTION
  // ==========================================================

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setPredictionLoading(true);
      setError(null);
      setPredictionError(null);

      try {
        const batchData =
          await getBatchById(id);

        if (!active) {
          return;
        }

        setBatch(
          batchData
        );
      } catch (err) {
        if (active) {
          setError(
            err?.response?.data
              ?.message ||
              err?.message ||
              "Unable to load this batch."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }


      // ------------------------------------------------------
      // Prediction is intentionally separate.
      //
      // A batch can exist without having been analyzed yet.
      // ------------------------------------------------------

      try {
        const predictionData =
          await getLatestPrediction(
            id
          );

        if (!active) {
          return;
        }

        setPrediction(
          predictionData
        );
      } catch (err) {
        if (active) {
          setPrediction(
            null
          );

          setPredictionError(
            err
          );
        }
      } finally {
        if (active) {
          setPredictionLoading(
            false
          );
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [id]);


  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <PageContainer
        title="Batch"
        subtitle="Loading batch information..."
      >
        <div className="min-h-[400px] flex items-center justify-center">
          <Loader label="Loading batch..." />
        </div>
      </PageContainer>
    );
  }


  // ==========================================================
  // ERROR
  // ==========================================================

  if (error || !batch) {
    return (
      <PageContainer
        title="Batch not found"
      >

        <Link
          to="/batches"
          className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-900"
        >
          <ArrowLeft size={14} />
          Back to batches
        </Link>

        <Card className="mt-5 max-w-xl">

          <div className="text-center">

            <div className="w-12 h-12 mx-auto rounded-full bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle
                size={22}
              />
            </div>

            <h2 className="text-base font-semibold text-ink mt-4">
              Unable to load batch
            </h2>

            <p className="text-sm text-muted mt-2">
              {error ||
                "This batch could not be found."}
            </p>

          </div>

        </Card>

      </PageContainer>
    );
  }


  // ==========================================================
  // PREDICTION VALUES
  // ==========================================================

  const freshness =
    prediction?.freshness ??
    batch.freshness ??
    null;

  const shelfLifeDays =
    prediction?.shelfLifeDays ??
    batch.shelfLifeDays ??
    null;

  const spoilageRisk =
    prediction
      ? prediction.spoilageRisk
      : batch.spoilageRisk ?? null;

  const riskLevel =
    prediction?.riskLevel ||
    riskLevelFromPercentage(
      spoilageRisk
    );

  // Decision-engine sub-fields (stored under decision.* for ml_python_service
  // predictions, or directly on prediction for legacy heuristic_mock records)
  const decisionObj = prediction?.decision || {};
  const decisionAction =
    decisionObj?.recommendation?.primary_action ??
    decisionObj?.action ??
    null;
  const decisionReasoning =
    decisionObj?.reasoning ??
    prediction?.reasoning ??
    null;
  const decisionUrgency =
    decisionObj?.recommendation?.urgency ??
    prediction?.urgency ??
    null;
  const decisionImpact =
    decisionObj?.impact ??
    prediction?.impact ??
    null;
  const decisionAllocations =
    decisionObj?.allocations ??
    prediction?.allocations ??
    [];
  const decisionFactors =
    prediction?.factors ?? [];
  const batchConditionLabel =
    prediction?.shelfLifeAssessment?.condition?.batch_condition ??
    prediction?.batchCondition ??
    null;


  return (
    <PageContainer
      title={batch.id}
      subtitle={`${batch.produce || "Produce"} · ${formatNumber(
        batch.quantityKg,
        1
      )} kg`}
    >

      <div className="space-y-5">

        {/* ==================================================
            BACK
        ================================================== */}

        <Link
          to="/batches"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
        >
          <ArrowLeft size={14} />
          Back to batches
        </Link>


        {/* ==================================================
            TOP
        ================================================== */}

        <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-5">

          {/* ----------------------------------------------
              BATCH SUMMARY
          ---------------------------------------------- */}

          <motion.div
            initial={{
              opacity: 0,
              y: 10,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
          >
            <Card className="h-full">

              <div className="flex flex-col items-center text-center">

                <div className="w-20 h-20 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center">
                  <Package
                    size={34}
                  />
                </div>

                <h2 className="text-lg font-semibold text-ink mt-4">
                  {batch.produce ||
                    "Unknown produce"}
                </h2>

                <p className="font-mono text-xs text-muted mt-1">
                  {batch.id}
                </p>


                <div className="mt-6">

                  {freshness !=
                  null ? (
                    <FreshnessRing
                      score={Math.round(
                        freshness
                      )}
                      size={120}
                      strokeWidth={9}
                      sublabel={
                        riskLevel
                      }
                    />
                  ) : (
                    <div className="w-[120px] h-[120px] rounded-full border-8 border-border flex items-center justify-center">
                      <div className="text-center">
                        <ScanLine
                          size={24}
                          className="mx-auto text-muted"
                        />

                        <p className="text-[10px] text-muted mt-1">
                          Not analyzed
                        </p>
                      </div>
                    </div>
                  )}

                </div>


                <div className="mt-5">
                  <RiskBadge
                    level={
                      riskLevel
                    }
                  />
                </div>


                {!prediction && (
                  <Link
                    to={`/analyze?batch=${batch.id}`}
                    className="w-full mt-5"
                  >
                    <Button
                      icon={ScanLine}
                      className="w-full justify-center"
                    >
                      Analyze batch
                    </Button>
                  </Link>
                )}

              </div>

            </Card>
          </motion.div>


          {/* ----------------------------------------------
              BATCH INFORMATION
          ---------------------------------------------- */}

          <div className="space-y-5">

            <Card>
              <CardHeader
                title="Batch information"
                subtitle="Source and inventory information"
              />

              <div className="grid grid-cols-2 md:grid-cols-3 gap-5">

                <InfoItem
                  icon={MapPin}
                  label="Origin"
                  value={
                    batch.origin
                  }
                />

                <InfoItem
                  icon={MapPin}
                  label="Current location"
                  value={
                    batch.currentLocation ||
                    batch._raw
                      ?.currentLocation
                  }
                />

                <InfoItem
                  icon={Package}
                  label="Quantity"
                  value={`${formatNumber(
                    batch.quantityKg,
                    1
                  )} kg`}
                />

                <InfoItem
                  icon={CalendarDays}
                  label="Harvest date"
                  value={formatDate(
                    batch.harvestDate
                  )}
                />

                <InfoItem
                  icon={CalendarDays}
                  label="Arrival date"
                  value={formatDate(
                    batch._raw
                      ?.arrivalDate
                  )}
                />

                <InfoItem
                  icon={Clock3}
                  label="Created"
                  value={formatDateTime(
                    batch._raw
                      ?.createdAt
                  )}
                />

              </div>
            </Card>


            {/* --------------------------------------------
                PREDICTION STATUS
            -------------------------------------------- */}

            {!predictionLoading &&
              !prediction && (
                <Card>

                  <div className="flex items-start gap-3">

                    <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                      <ScanLine
                        size={20}
                      />
                    </div>

                    <div className="flex-1">

                      <h3 className="text-sm font-semibold text-ink">
                        This batch has not been analyzed
                      </h3>

                      <p className="text-xs text-muted mt-1 leading-5">
                        Upload one or more produce
                        images and provide the available
                        storage conditions to calculate
                        freshness, shelf life and
                        spoilage risk.
                      </p>

                      <Link
                        to={`/analyze?batch=${batch.id}`}
                        className="inline-block mt-4"
                      >
                        <Button
                          size="sm"
                          icon={ScanLine}
                        >
                          Run AI analysis
                        </Button>
                      </Link>

                    </div>

                  </div>

                </Card>
              )}

          </div>

        </div>


        {/* ==================================================
            AI RESULT
        ================================================== */}

        {prediction && (
          <motion.div
            initial={{
              opacity: 0,
              y: 10,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.35,
            }}
            className="space-y-5"
          >

            {/* ----------------------------------------------
                SOURCE — always say what kind of prediction this is
            ---------------------------------------------- */}

            {prediction.source === "ml_python_service" ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
                <CheckCircle2 size={14} className="shrink-0" />
                <span>
                  <span className="font-semibold">AI image analysis</span>
                  {" "}— computer vision + shelf-life assessment
                  {prediction.createdAt
                    ? ` · ${formatDateTime(prediction.createdAt)}`
                    : ""}
                </span>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>
                  <span className="font-semibold">Heuristic estimate</span>
                  {" "}— not based on image analysis. Run an AI analysis
                  with produce images for a real assessment.
                </span>
              </div>
            )}

            {/* ----------------------------------------------
                METRICS
            ---------------------------------------------- */}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

              <Metric
                icon={ScanLine}
                label="Freshness score"
                value={
                  freshness !=
                  null
                    ? Math.round(
                        freshness
                      )
                    : null
                }
                suffix="/100"
              />

              <Metric
                icon={Clock3}
                label="Remaining shelf life"
                value={
                  shelfLifeDays
                }
                suffix="days"
              />

              <Metric
                icon={AlertTriangle}
                label="Spoilage risk"
                value={
                  spoilageRisk !=
                  null
                    ? Math.round(
                        spoilageRisk
                      )
                    : riskLevel &&
                      riskLevel !== "UNKNOWN"
                    ? riskLevel
                    : null
                }
                suffix={
                  spoilageRisk !=
                  null
                    ? "%"
                    : undefined
                }
              />

              <Metric
                icon={Sparkles}
                label="Confidence"
                value={
                  prediction.confidence != null
                    ? `${Math.round(Number(prediction.confidence) * 100)}%`
                    : null
                }
              />

            </div>


            {/* ----------------------------------------------
                AI OVERVIEW + ACTION
            ---------------------------------------------- */}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              <Card>
                <CardHeader
                  title="AI assessment"
                  subtitle="Combined CV and shelf-life prediction"
                  action={
                    <RiskBadge
                      level={
                        riskLevel
                      }
                    />
                  }
                />

                <div className="grid grid-cols-2 gap-4">

                  <div className="rounded-lg bg-bg p-3">
                    <p className="text-xs text-muted">
                      Visual class
                    </p>

                    <p className="text-sm font-semibold text-ink mt-1">
                      {prediction.visualClass ||
                        "Unknown"}
                    </p>
                  </div>

                  <div className="rounded-lg bg-bg p-3">
                    <p className="text-xs text-muted">
                      Batch condition
                    </p>

                    <p className="text-sm font-semibold text-ink mt-1">
                      {batchConditionLabel ||
                        "Unknown"}
                    </p>
                  </div>

                  <div className="rounded-lg bg-bg p-3">
                    <p className="text-xs text-muted">
                      Shelf-life range
                    </p>

                    <p className="text-sm font-mono font-semibold text-ink mt-1">
                      {formatRange(
                        prediction.shelfLifeRange
                      )}
                    </p>
                  </div>

                  <div className="rounded-lg bg-bg p-3">
                    <p className="text-xs text-muted">
                      Urgency
                    </p>

                    <p className="text-sm font-semibold text-ink mt-1">
                      {decisionUrgency ||
                        "Unknown"}
                    </p>
                  </div>

                </div>


                {prediction.reasoning && (
                  <div className="border-t border-border mt-5 pt-4">

                    <p className="text-xs font-medium text-muted mb-2">
                      Reasoning
                    </p>

                    <p className="text-sm text-ink leading-6">
                      {
                        prediction.reasoning
                      }
                    </p>

                  </div>
                )}

              </Card>


              <Card>

                <CardHeader
                  title="Recommended action"
                  subtitle="Output from the deterministic decision engine"
                  action={
                    <Sparkles
                      size={17}
                      className="text-brand-700"
                    />
                  }
                />

                <div className="rounded-xl bg-brand-50 border border-brand-100 p-4">

                  <p className="text-xs text-brand-700 font-medium">
                    Recommended action
                  </p>

                  <h3 className="text-lg font-semibold text-ink mt-1">
                    {decisionAction ||
                      "Monitor"}
                  </h3>

                  {decisionReasoning && (
                    <p className="text-sm text-ink leading-6 mt-2">
                      {decisionReasoning}
                    </p>
                  )}

                </div>


                {decisionImpact && (
                  <div className="grid grid-cols-2 gap-3 mt-4">

                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted">
                        Expected waste
                      </p>

                      <p className="text-sm font-mono font-semibold text-ink mt-1">
                        {decisionImpact
                          ?.expected_waste_kg ??
                          "—"}{" "}
                        kg
                      </p>
                    </div>

                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted">
                        Recovered value
                      </p>

                      <p className="text-sm font-mono font-semibold text-ink mt-1">
                        {decisionImpact
                          ?.estimated_recovered_value !=
                        null
                          ? `₹${Number(
                              decisionImpact
                                .estimated_recovered_value
                            ).toLocaleString(
                              "en-IN"
                            )}`
                          : "—"}
                      </p>
                    </div>

                  </div>
                )}

              </Card>

            </div>


            {/* ----------------------------------------------
                INPUT SIGNALS
            ---------------------------------------------- */}

            <Card>
              <CardHeader
                title="Conditions used by the AI"
                subtitle="Inputs recorded for this prediction"
              />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

                <Metric
                  icon={
                    Thermometer
                  }
                  label="Temperature"
                  value={
                    prediction
                      .inputSignals
                      ?.temperature
                  }
                  suffix="°C"
                />

                <Metric
                  icon={Droplets}
                  label="Humidity"
                  value={
                    prediction
                      .inputSignals
                      ?.humidity
                  }
                  suffix="%"
                />

                <Metric
                  icon={Clock3}
                  label="Harvest age"
                  value={
                    prediction
                      .inputSignals
                      ?.daysSinceHarvest
                  }
                  suffix="days"
                />

                <Metric
                  icon={Truck}
                  label="Transport"
                  value={
                    prediction
                      .inputSignals
                      ?.transportDurationHours
                  }
                  suffix="hours"
                />

              </div>

            </Card>


            {/* ----------------------------------------------
                FACTORS
            ---------------------------------------------- */}

            {decisionFactors?.length >
              0 && (
              <Card>
                <CardHeader
                  title="Factors affecting shelf life"
                  subtitle="Signals considered by the shelf-life assessment"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                  {decisionFactors.map(
                    (
                      factor,
                      index
                    ) => (
                      <div
                        key={
                          index
                        }
                        className="rounded-lg border border-border p-4"
                      >

                        <div className="flex items-start justify-between gap-3">

                          <div>
                            <p className="text-sm font-medium text-ink">
                              {formatFactorName(
                                factor.factor
                              )}
                            </p>

                            {factor.reason && (
                              <p className="text-xs text-muted mt-1 leading-5">
                                {
                                  factor.reason
                                }
                              </p>
                            )}
                          </div>

                          {factor.impact && (
                            <span className="text-[11px] text-muted shrink-0">
                              {
                                factor.impact
                              }
                            </span>
                          )}

                        </div>

                      </div>
                    )
                  )}

                </div>

              </Card>
            )}


            {/* ----------------------------------------------
                EVIDENCE
            ---------------------------------------------- */}

            {prediction.evidence?.length >
              0 && (
              <Card>
                <CardHeader
                  title="Knowledge evidence"
                  subtitle="Evidence returned by the shelf-life RAG layer"
                />

                <div className="space-y-3">

                  {prediction.evidence.map(
                    (
                      evidence,
                      index
                    ) => (
                      <div
                        key={
                          index
                        }
                        className="rounded-lg border border-border p-4"
                      >

                        <p className="text-[11px] text-muted">
                          Evidence{" "}
                          {index + 1}
                        </p>

                        <p className="text-sm text-ink mt-1 leading-6">
                          {typeof evidence ===
                          "string"
                            ? evidence
                            : evidence.text ||
                              evidence.content ||
                              JSON.stringify(
                                evidence
                              )}
                        </p>

                      </div>
                    )
                  )}

                </div>

              </Card>
            )}


            {/* ----------------------------------------------
                ALLOCATIONS
            ---------------------------------------------- */}

            {decisionAllocations?.length >
              0 && (
              <Card>
                <CardHeader
                  title="Recommended allocations"
                  subtitle="Decision-engine output for redistribution"
                />

                <div className="space-y-2">

                  {decisionAllocations.map(
                    (
                      allocation,
                      index
                    ) => (
                      <div
                        key={
                          index
                        }
                        className="flex items-center justify-between gap-4 rounded-lg border border-border p-4"
                      >

                        <div className="min-w-0">

                          <p className="text-sm font-medium text-ink">
                            {allocation.destination ||
                              allocation.location ||
                              "Destination"}
                          </p>

                          {allocation.reason && (
                            <p className="text-xs text-muted mt-1">
                              {
                                allocation.reason
                              }
                            </p>
                          )}

                        </div>

                        <p className="text-sm font-mono font-semibold text-ink whitespace-nowrap">
                          {allocation.quantity_kg ??
                            allocation.quantityKg ??
                            "—"}{" "}
                          kg
                        </p>

                      </div>
                    )
                  )}

                </div>

              </Card>
            )}


            {/* ----------------------------------------------
                PREDICTION METADATA
            ---------------------------------------------- */}

            <Card>

              <CardHeader
                title="Prediction metadata"
                subtitle="Information about this AI result"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">

                <InfoItem
                  icon={
                    ScanLine
                  }
                  label="Visual class"
                  value={
                    prediction.visualClass
                  }
                />

                <InfoItem
                  icon={
                    Sparkles
                  }
                  label="Confidence"
                  value={
                    prediction.confidence != null
                      ? `${Math.round(Number(prediction.confidence) * 100)}%`
                      : null
                  }
                />

                <InfoItem
                  icon={
                    ImageIcon
                  }
                  label="Source"
                  value={
                    prediction.source === "ml_python_service"
                      ? "AI image analysis"
                      : prediction.source === "heuristic_mock"
                      ? "Heuristic estimate"
                      : prediction.source
                  }
                />

                <InfoItem
                  icon={
                    CalendarDays
                  }
                  label="Prediction time"
                  value={formatDateTime(
                    prediction.createdAt
                  )}
                />

              </div>

            </Card>

          </motion.div>
        )}


        {/* ==================================================
            PREDICTION ERROR
        ================================================== */}

        {!predictionLoading &&
          predictionError &&
          !prediction && (
            <Card>

              <div className="flex items-start gap-3">

                <div className="w-9 h-9 rounded-lg bg-yellow-50 text-yellow-700 flex items-center justify-center">
                  <AlertTriangle
                    size={18}
                  />
                </div>

                <div>
                  <p className="text-sm font-medium text-ink">
                    No AI prediction available
                  </p>

                  <p className="text-xs text-muted mt-1 leading-5">
                    This batch exists, but a
                    prediction has not been stored
                    yet.
                  </p>

                </div>

              </div>

            </Card>
          )}


        {/* ==================================================
            TRACEABILITY
        ================================================== */}

        <Card>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

            <div>

              <p className="text-sm font-semibold text-ink">
                Supply-chain traceability
              </p>

              <p className="text-xs text-muted mt-1">
                View the batch passport, movement
                history and supply-chain timeline.
              </p>

            </div>

            <Link
              to={`/traceability?batch=${batch.id}`}
            >
              <Button
                variant="secondary"
                icon={ArrowRight}
              >
                Open traceability
              </Button>
            </Link>

          </div>

        </Card>

      </div>

    </PageContainer>
  );
}