import { motion } from "framer-motion";
import { Package, AlertTriangle, TrendingDown, Boxes } from "lucide-react";
import Card from "../ui/Card";
import AnimatedCounter from "../ui/AnimatedCounter";

/**
 * Displays real wasteMetrics from GET /api/dashboard/overview.
 *
 * Real shape (waste.service.js computeWasteMetrics):
 *   totalBatches, totalInventoryKg, atRiskBatchCount, atRiskInventoryKg,
 *   criticalBatchCount, estimatedSpoilageKg, estimatedSpoilagePercent,
 *   estimatedValueAtRisk, batchesWithPredictions, disclaimer
 */
export default function OverviewCards({ wasteMetrics }) {
  if (!wasteMetrics) return null;

  const stats = [
    {
      label: "Total Batches",
      value: wasteMetrics.totalBatches ?? 0,
      suffix: "",
      icon: Boxes,
      tone: "text-brand-700 bg-brand-50",
    },
    {
      label: "Total Inventory",
      value: wasteMetrics.totalInventoryKg ?? 0,
      suffix: " kg",
      icon: Package,
      tone: "text-brand-700 bg-brand-50",
    },
    {
      label: "At-Risk Batches",
      value: wasteMetrics.atRiskBatchCount ?? 0,
      suffix: "",
      icon: AlertTriangle,
      tone: "text-risk-high bg-[#FBEAE6]",
    },
    {
      label: "Est. Spoilage",
      value: wasteMetrics.estimatedSpoilageKg ?? 0,
      suffix: " kg",
      icon: TrendingDown,
      tone: "text-risk-medium bg-[#FBF1DF]",
    },
  ];

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.07 } } }}
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
    >
      {stats.map((s) => (
        <motion.div
          key={s.label}
          variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <Card className="flex items-start justify-between hover:shadow-pop hover:-translate-y-0.5 transition-all duration-200">
            <div>
              <p className="text-xs text-muted">{s.label}</p>
              <p className="text-xl font-semibold font-mono mt-1.5 text-ink">
                <AnimatedCounter value={s.value} />
                {s.suffix}
              </p>
            </div>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.tone}`}>
              <s.icon size={17} />
            </div>
          </Card>
        </motion.div>
      ))}
      {wasteMetrics.disclaimer && (
        <p className="col-span-full text-[11px] text-muted italic mt-1">
          ⚠ {wasteMetrics.disclaimer}
        </p>
      )}
    </motion.div>
  );
}
