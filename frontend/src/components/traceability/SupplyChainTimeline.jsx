import { motion } from "framer-motion";
import { CheckCircle2, Clock } from "lucide-react";
import { formatDate } from "../../utils/formatting";

/**
 * Renders supply chain stages from the real traceability service.
 *
 * Real stage shape (traceability.service.js):
 *   { stage: string, completed: boolean, date: Date|null }
 */
export default function SupplyChainTimeline({ stages }) {
  return (
    <motion.ol
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.1 } } }}
      className="relative border-l border-border ml-3 space-y-5"
    >
      {stages.map((s) => (
        <motion.li
          key={s.stage}
          variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0 } }}
          transition={{ duration: 0.28 }}
          className="ml-6"
        >
          <span
            className={`absolute -left-[13px] w-6 h-6 rounded-full border-2 flex items-center justify-center ${
              s.completed
                ? "bg-brand-700 border-brand-700 text-white"
                : "bg-bg border-border text-muted"
            }`}
          >
            {s.completed ? <CheckCircle2 size={13} /> : <Clock size={12} />}
          </span>
          <div className="flex items-baseline justify-between gap-3">
            <p className={`text-sm font-semibold ${s.completed ? "text-ink" : "text-muted"}`}>
              {s.stage}
            </p>
            <span className="text-xs font-mono text-muted shrink-0">
              {s.date ? formatDate(s.date) : "Pending"}
            </span>
          </div>
        </motion.li>
      ))}
    </motion.ol>
  );
}
