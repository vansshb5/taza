import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Calendar, Thermometer, Droplets, ScanLine } from "lucide-react";
import PageContainer from "../components/layout/PageContainer";
import Card, { CardHeader } from "../components/ui/Card";
import FreshnessRing from "../components/ui/FreshnessRing";
import ActionBadge from "../components/recommendations/ActionBadge";
import Loader from "../components/ui/Loader";
import DecisionResultPanel from "../components/inspection/DecisionResultPanel";
import { getBatchById } from "../api/batches";
import { getLatestPrediction } from "../api/predictions";
import { getLatestRecommendation } from "../api/recommendations";
import { formatKg, formatDate } from "../utils/formatting";

/**
 * Batch Details — fetches and displays real stored results from Express/MongoDB:
 *
 *   Batch       → GET /api/batches/:id
 *   Prediction  → GET /api/predictions/:batchId
 *                 Includes: freshnessScore, shelfLifeDays, spoilageProbability,
 *                           riskLevel, confidence, source, visualClass,
 *                           classDistribution, shelfLifeAssessment, decision, aiInsights
 *   Recommendation → GET /api/recommendations/:batchId
 *                 Includes: actionType, urgencyLevel, reason, reasonFactors, ...
 *
 * The DecisionResultPanel displays the FULL prediction doc (including the
 * embedded decision engine result in prediction.decision) if it came from
 * the ML pipeline. For heuristic-only predictions, it shows what's available.
 *
 * "Analyze Batch" redirects to /inspect because the real ML analysis
 * requires uploading produce images — it cannot be triggered without them.
 *
 * All displayed values come from the API — nothing is invented here.
 */
export default function BatchDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [batch, setBatch] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.all([
      getBatchById(id),
      getLatestPrediction(id).catch(() => null),
      getLatestRecommendation(id).catch(() => null),
    ])
      .then(([b, p, rec]) => {
        if (!active) return;
        setBatch(b ?? null);
        setPrediction(p ?? null);
        setRecommendation(rec ?? null);
      })
      .catch((err) => active && setError(err))
      .finally(() => active && setLoading(false));

    return () => { active = false; };
  }, [id]);

  if (loading) {
    return (
      <PageContainer title="Batch Details">
        <Loader label="Loading batch…" />
      </PageContainer>
    );
  }

  if (error || !batch) {
    return (
      <PageContainer title="Batch Details">
        <Link to="/batches" className="text-brand-700 text-sm hover:underline inline-flex items-center gap-1">
          <ArrowLeft size={14} /> Back to Batches
        </Link>
        <p className="mt-4 text-sm text-red-600">
          {error ? "Failed to load batch." : "Batch not found."}
        </p>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={batch.batchCode ?? batch._id}
      subtitle={`${batch.productName} · ${formatKg(batch.quantity)}`}
    >
      <Link
        to="/batches"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink mb-5"
      >
        <ArrowLeft size={14} /> Back to Batches
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Left sidebar: freshness ring + quick action ─────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <Card className="h-full flex flex-col items-center text-center gap-4">
            <FreshnessRing
              score={batch.latestFreshnessScore ?? 0}
              size={120}
              strokeWidth={9}
              sublabel={
                batch.latestFreshnessScore != null ? "Freshness" : "No analysis"
              }
            />

            {/* Show stored recommendation action */}
            {recommendation ? (
              <div className="space-y-2">
                <ActionBadge action={recommendation.actionType} />
                {recommendation.urgencyLevel && (
                  <p className="text-xs text-muted">
                    Urgency: {recommendation.urgencyLevel}
                  </p>
                )}
                {recommendation.reason && (
                  <p className="text-xs text-muted leading-relaxed px-2">
                    {recommendation.reason}
                  </p>
                )}
              </div>
            ) : prediction ? (
              <p className="text-xs text-muted italic">
                Prediction available — no recommendation yet.
              </p>
            ) : (
              <p className="text-xs text-muted italic">No analysis yet.</p>
            )}

            {/* Analyze Batch — must upload images, so redirect to InspectProduce */}
            <button
              onClick={() => navigate("/inspect")}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-brand-700 text-white text-sm font-semibold hover:bg-brand-900 transition-colors"
            >
              <ScanLine size={14} />
              {prediction ? "Re-analyze Batch" : "Analyze Batch"}
            </button>
            <p className="text-[11px] text-muted italic -mt-2">
              Upload produce images to run full AI analysis
            </p>
          </Card>
        </motion.div>

        {/* ── Right: details ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08 }}
          className="lg:col-span-2 space-y-5"
        >
          {/* Batch Information */}
          <Card>
            <CardHeader title="Batch Information" />
            <dl className="grid grid-cols-2 gap-y-4 gap-x-4">
              <Info label="Origin" value={batch.origin} icon={MapPin} />
              <Info label="Harvest Date" value={formatDate(batch.harvestDate)} icon={Calendar} />
              <Info label="Arrival Date" value={formatDate(batch.arrivalDate)} icon={Calendar} />
              <Info label="Location" value={batch.currentLocation} icon={MapPin} />
              <div>
                <dt className="text-xs text-muted">Quantity</dt>
                <dd className="text-sm font-mono font-medium text-ink mt-0.5">
                  {formatKg(batch.quantity)} {batch.unit}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Status</dt>
                <dd className="text-sm font-medium text-ink mt-0.5">{batch.status}</dd>
              </div>
              {batch.variety && (
                <div>
                  <dt className="text-xs text-muted">Variety</dt>
                  <dd className="text-sm font-medium text-ink mt-0.5">{batch.variety}</dd>
                </div>
              )}
              {batch.storageTemperatureCelsius != null && (
                <Info label="Storage Temp" value={`${batch.storageTemperatureCelsius}°C`} icon={Thermometer} />
              )}
              {batch.storageHumidityPercent != null && (
                <Info label="Humidity" value={`${batch.storageHumidityPercent}%`} icon={Droplets} />
              )}
            </dl>
          </Card>

          {/* Full prediction + decision panel (from ML pipeline) */}
          {prediction ? (
            <DecisionResultPanel prediction={prediction} batchId={batch._id} />
          ) : (
            <Card>
              <CardHeader
                title="AI Analysis"
                subtitle="No analysis on file for this batch"
              />
              <p className="text-sm text-muted">
                Click "Analyze Batch" to upload produce images and run the full AI pipeline.
              </p>
            </Card>
          )}

          {/* Traceability link */}
          <Card className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink">Supply Chain Passport</p>
              <p className="text-xs text-muted">Full traceability history</p>
            </div>
            <Link
              to={`/traceability?batch=${batch._id}`}
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              Open Passport →
            </Link>
          </Card>
        </motion.div>
      </div>
    </PageContainer>
  );
}

function Info({ label, value, icon: Icon }) {
  return (
    <div>
      <dt className="text-xs text-muted flex items-center gap-1">
        {Icon && <Icon size={11} />} {label}
      </dt>
      <dd className="text-sm font-medium text-ink mt-0.5">{value ?? "—"}</dd>
    </div>
  );
}
