import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import FreshnessRing from "../ui/FreshnessRing";
import BatchStatus from "./BatchStatus";
import { formatKg, formatDays, formatDate } from "../../utils/formatting";

export default function BatchTable({ batches }) {
  const navigate = useNavigate();

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            {["Batch Code", "Product", "Quantity", "Origin", "Harvest Date", "Freshness", "Shelf Life", "Risk"].map((c) => (
              <th key={c} className="px-4 py-3 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {batches.map((b, i) => (
            <motion.tr
              key={b._id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25, delay: i * 0.02 }}
              onClick={() => navigate(`/batches/${b._id}`)}
              className="border-b border-border last:border-0 hover:bg-bg/60 cursor-pointer transition-colors"
            >
              <td className="px-4 py-3 font-mono font-medium text-ink">
                {b.batchCode ?? b._id}
              </td>
              <td className="px-4 py-3 text-muted">
                {b.productName}
                {b.variety ? <span className="ml-1 text-[11px]">({b.variety})</span> : null}
              </td>
              <td className="px-4 py-3 font-mono text-ink">
                {formatKg(b.quantity)}
              </td>
              <td className="px-4 py-3 text-muted">{b.origin}</td>
              <td className="px-4 py-3 text-muted">{formatDate(b.harvestDate)}</td>
              <td className="px-4 py-3">
                <FreshnessRing
                  score={b.latestFreshnessScore ?? null}
                  size={34}
                  strokeWidth={4}
                />
              </td>
              <td className="px-4 py-3 font-mono text-ink">
                {b.latestShelfLifeDays != null
                  ? formatDays(b.latestShelfLifeDays)
                  : "—"}
              </td>
              <td className="px-4 py-3">
                <BatchStatus spoilageProb={b.latestSpoilageProbability} />
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
