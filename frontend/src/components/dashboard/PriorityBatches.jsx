import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Card, { CardHeader } from "../ui/Card";
import FreshnessRing from "../ui/FreshnessRing";
import { formatDays, formatKg } from "../../utils/formatting";

/**
 * Shows urgent batches from GET /api/dashboard/urgent
 * (ACTIVE batches sorted by lowest latestShelfLifeDays first).
 *
 * Real Batch fields used:
 *   _id, batchCode, productName, produceType, quantity, unit,
 *   latestFreshnessScore, latestShelfLifeDays, latestSpoilageProbability
 */
export default function PriorityBatches({ batches }) {
  const priority = (batches ?? []).slice(0, 5); // already sorted by server

  return (
    <Card>
      <CardHeader
        title="Priority Batches"
        subtitle="Active batches sorted by urgency (lowest shelf life first)"
        action={
          <Link
            to="/batches"
            className="text-xs font-medium text-brand-700 flex items-center gap-1 hover:underline"
          >
            View all <ArrowRight size={12} />
          </Link>
        }
      />

      {priority.length === 0 ? (
        <p className="text-sm text-muted py-4">No active batches yet.</p>
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.06 } } }}
          className="divide-y divide-border"
        >
          {priority.map((b) => (
            <motion.div
              key={b._id}
              variants={{ hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0 } }}
            >
              <Link
                to={`/batches/${b._id}`}
                className="flex items-center gap-4 py-3 first:pt-0 last:pb-0 hover:bg-bg/60 -mx-2 px-2 rounded-lg transition-colors"
              >
                <FreshnessRing
                  score={b.latestFreshnessScore ?? null}
                  size={44}
                  strokeWidth={5}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-ink font-mono">
                      {b.batchCode ?? b._id}
                    </p>
                    <span className="text-xs text-muted">{b.productName}</span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    {formatKg(b.quantity)} ·{" "}
                    {b.latestShelfLifeDays != null
                      ? `${formatDays(b.latestShelfLifeDays)} left`
                      : "No prediction yet"}
                  </p>
                </div>
                {b.latestSpoilageProbability != null && (
                  <RiskPill prob={b.latestSpoilageProbability} />
                )}
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </Card>
  );
}

function RiskPill({ prob }) {
  const pct = Math.round(prob * 100);
  const tone =
    pct >= 70
      ? "text-red-700 bg-red-50"
      : pct >= 45
      ? "text-orange-700 bg-orange-50"
      : pct >= 20
      ? "text-amber-700 bg-amber-50"
      : "text-brand-700 bg-brand-50";
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tone}`}>
      {pct}% risk
    </span>
  );
}
