import { motion } from "framer-motion";
import { Activity, Eye, TrendingUp, CheckCircle2, Package } from "lucide-react";
import { formatDate } from "../../utils/formatting";

/**
 * Renders the real timeline events from GET /api/traceability/:batchId
 *
 * Real event shape:
 *   { type: string, timestamp: Date, summary: string, data: object }
 *
 * Event types: BATCH_CREATED | QUALITY_INSPECTION | PREDICTION | RECOMMENDATION
 */
const TYPE_META = {
  BATCH_CREATED:      { icon: Package,     tone: "text-brand-700 bg-brand-50" },
  QUALITY_INSPECTION: { icon: Eye,         tone: "text-amber-700 bg-amber-50" },
  PREDICTION:         { icon: TrendingUp,  tone: "text-blue-700 bg-blue-50" },
  RECOMMENDATION:     { icon: CheckCircle2, tone: "text-brand-700 bg-brand-50" },
};

export default function TimelineEventList({ events }) {
  return (
    <motion.ol
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.06 } } }}
      className="relative border-l border-border ml-3 space-y-5"
    >
      {events.map((ev, i) => {
        const meta = TYPE_META[ev.type] ?? { icon: Activity, tone: "text-muted bg-bg" };
        const Icon = meta.icon;
        return (
          <motion.li
            key={i}
            variants={{ hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0 } }}
            transition={{ duration: 0.25 }}
            className="ml-6"
          >
            <span
              className={`absolute -left-[13px] w-6 h-6 rounded-full flex items-center justify-center ${meta.tone}`}
            >
              <Icon size={13} />
            </span>
            <div className="flex items-baseline justify-between gap-3 mb-0.5">
              <p className="text-sm font-medium text-ink">{ev.type.replace(/_/g, " ")}</p>
              <span className="text-xs font-mono text-muted shrink-0">
                {ev.timestamp ? formatDate(ev.timestamp) : "—"}
              </span>
            </div>
            <p className="text-xs text-muted leading-relaxed">{ev.summary}</p>
          </motion.li>
        );
      })}
    </motion.ol>
  );
}
