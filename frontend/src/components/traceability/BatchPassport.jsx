import { QrCode } from "lucide-react";
import Card, { CardHeader } from "../ui/Card";
import FreshnessRing from "../ui/FreshnessRing";
import SupplyChainTimeline from "./SupplyChainTimeline";
import TimelineEventList from "./TimelineEventList";
import { formatDays, formatDate, formatPercent } from "../../utils/formatting";

/**
 * Displays the real batch passport from GET /api/traceability/:batchId.
 *
 * Real response shape (traceability.service.js):
 *   batchId, batchCode, productName, produceType, variety,
 *   quantity, unit, origin, currentLocation, status,
 *   harvestDate, arrivalDate,
 *   currentFreshness: { freshnessScore, shelfLifeDays, spoilageProbability, lastUpdated },
 *   supplyChainStages: [{ stage, completed, date }],
 *   timeline: [{ type, timestamp, summary, data }],
 *   totalEvents
 */
export default function BatchPassport({ passport }) {
  const freshness = passport.currentFreshness ?? {};

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Freshness card */}
        <Card className="flex flex-col items-center text-center">
          <CardHeader
            title="Digital Passport"
            subtitle={passport.batchCode ?? String(passport.batchId)}
          />
          <div className="w-36 h-36 rounded-xl bg-bg border border-border flex items-center justify-center text-muted mb-4">
            <QrCode size={64} strokeWidth={1} />
          </div>
          {freshness.freshnessScore != null ? (
            <FreshnessRing score={freshness.freshnessScore} size={72} strokeWidth={7} />
          ) : (
            <p className="text-sm text-muted italic">No analysis yet</p>
          )}
          <div className="mt-3 space-y-1">
            {freshness.shelfLifeDays != null && (
              <p className="text-xs text-muted">
                {formatDays(freshness.shelfLifeDays)} remaining
              </p>
            )}
            {freshness.spoilageProbability != null && (
              <p className="text-xs text-muted">
                {formatPercent(freshness.spoilageProbability * 100)} spoilage risk
              </p>
            )}
            {freshness.lastUpdated && (
              <p className="text-[11px] text-muted italic">
                Updated {formatDate(freshness.lastUpdated)}
              </p>
            )}
          </div>
        </Card>

        {/* Batch info */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Batch Details"
            subtitle={`${passport.productName}${passport.variety ? ` (${passport.variety})` : ""}`}
          />
          <dl className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
            <Info label="Produce Type" value={passport.produceType} />
            <Info label="Quantity" value={`${passport.quantity} ${passport.unit}`} />
            <Info label="Origin" value={passport.origin} />
            <Info label="Location" value={passport.currentLocation} />
            <Info label="Harvest Date" value={formatDate(passport.harvestDate)} />
            <Info label="Arrival Date" value={formatDate(passport.arrivalDate)} />
            <Info label="Status" value={passport.status} />
          </dl>
        </Card>
      </div>

      {/* Supply chain stages */}
      {passport.supplyChainStages && passport.supplyChainStages.length > 0 && (
        <Card>
          <CardHeader title="Supply Chain Journey" />
          <SupplyChainTimeline stages={passport.supplyChainStages} />
        </Card>
      )}

      {/* Full event timeline */}
      {passport.timeline && passport.timeline.length > 0 && (
        <Card>
          <CardHeader
            title="Event Timeline"
            subtitle={`${passport.totalEvents} event${passport.totalEvents !== 1 ? "s" : ""}`}
          />
          <TimelineEventList events={passport.timeline} />
        </Card>
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="text-sm font-medium text-ink mt-0.5">{value ?? "—"}</dd>
    </div>
  );
}
