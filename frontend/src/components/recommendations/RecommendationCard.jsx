import { Link } from "react-router-dom";
import Card from "../ui/Card";
import ActionBadge from "./ActionBadge";
import { formatKg, formatPercent } from "../../utils/formatting";

/**
 * Displays one real Recommendation document from the Express backend.
 *
 * Real fields used:
 *   _id, batchId, actionType, urgencyLevel, reason,
 *   reasonFactors { shelfLifeDays, freshnessScore, spoilageProbability, riskLevel, bestMarket },
 *   expectedWasteKg, expectedRevenue, confidence,
 *   _batchRef { productName, produceType, quantity, unit }
 */

const URGENCY_TONE = {
  LOW: "text-brand-700 bg-brand-50",
  MEDIUM: "text-amber-700 bg-amber-50",
  HIGH: "text-orange-700 bg-orange-50",
  CRITICAL: "text-red-700 bg-red-50",
};

export default function RecommendationCard({ rec }) {
  const batch = rec._batchRef;
  const urgencyTone = URGENCY_TONE[rec.urgencyLevel] ?? "text-muted bg-bg";

  return (
    <Card className="flex flex-col gap-3 hover:shadow-pop hover:-translate-y-0.5 transition-all duration-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={`/batches/${rec.batchId}`}
            className="font-mono text-sm font-semibold text-ink hover:underline"
          >
            {batch?.batchCode ?? rec.batchId}
          </Link>
          {batch && (
            <p className="text-xs text-muted mt-0.5">
              {batch.productName} · {formatKg(batch.quantity)} {batch.unit ?? "kg"}
            </p>
          )}
        </div>
        {rec.urgencyLevel && (
          <span
            className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${urgencyTone}`}
          >
            {rec.urgencyLevel}
          </span>
        )}
      </div>

      {/* Action */}
      <ActionBadge action={rec.actionType} />

      {/* Reason from backend */}
      {rec.reason && (
        <p className="text-sm text-muted leading-relaxed">{rec.reason}</p>
      )}

      {/* Key metrics */}
      <dl className="grid grid-cols-2 gap-2 mt-1">
        {rec.reasonFactors?.shelfLifeDays != null && (
          <Metric
            label="Shelf Life"
            value={`${rec.reasonFactors.shelfLifeDays} days`}
          />
        )}
        {rec.reasonFactors?.spoilageProbability != null && (
          <Metric
            label="Spoilage Risk"
            value={formatPercent(rec.reasonFactors.spoilageProbability * 100)}
          />
        )}
        {rec.expectedWasteKg != null && (
          <Metric label="Est. Waste" value={formatKg(rec.expectedWasteKg)} />
        )}
        {rec.confidence != null && (
          <Metric
            label="Confidence"
            value={formatPercent(rec.confidence * 100)}
          />
        )}
      </dl>

      {/* Target market if applicable */}
      {(rec.targetMarket || rec.targetLocation) && (
        <p className="text-xs text-brand-700 font-medium">
          → {rec.targetMarket ?? ""}{" "}
          {rec.targetLocation ? `(${rec.targetLocation})` : ""}
        </p>
      )}
    </Card>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <dt className="text-[11px] text-muted uppercase tracking-wide">{label}</dt>
      <dd className="text-sm font-mono font-semibold text-ink">{value}</dd>
    </div>
  );
}
