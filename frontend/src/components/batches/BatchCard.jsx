import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Card from "../ui/Card";
import FreshnessRing from "../ui/FreshnessRing";
import BatchStatus from "./BatchStatus";
import { formatKg, formatDays } from "../../utils/formatting";

/**
 * Real Batch fields from backend (Batch.js model):
 *   _id, batchCode, productName, produceType, variety,
 *   quantity, unit, origin, harvestDate, arrivalDate, currentLocation,
 *   status, latestFreshnessScore, latestShelfLifeDays, latestSpoilageProbability
 */
export default function BatchCard({ batch }) {
  const freshnessScore = batch.latestFreshnessScore;
  const shelfLifeDays = batch.latestShelfLifeDays;
  const spoilageProb = batch.latestSpoilageProbability; // 0–1

  return (
    <Link to={`/batches/${batch._id}`}>
      <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.2 }} className="h-full">
        <Card className="hover:shadow-pop transition-shadow h-full flex flex-col">
          {/* Produce type banner */}
          <div className="w-full h-14 rounded-lg overflow-hidden mb-4 bg-brand-50 flex items-center justify-center">
            <span className="text-3xl" role="img" aria-label={batch.produceType}>
              {produceEmoji(batch.produceType)}
            </span>
          </div>

          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="font-mono text-sm font-semibold text-ink truncate">
                {batch.batchCode ?? batch._id}
              </p>
              <p className="text-xs text-muted mt-0.5">
                {batch.productName} · {formatKg(batch.quantity)}
              </p>
            </div>
            <FreshnessRing
              score={freshnessScore ?? null}
              size={48}
              strokeWidth={5}
            />
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <span className="text-xs text-muted">
              {shelfLifeDays != null
                ? `${formatDays(shelfLifeDays)} left`
                : "No prediction yet"}
            </span>
            <BatchStatus spoilageProb={spoilageProb} />
          </div>
        </Card>
      </motion.div>
    </Link>
  );
}

/** Maps produce type string to a simple emoji — purely decorative fallback */
function produceEmoji(type) {
  const map = {
    mango: "🥭", tomato: "🍅", banana: "🍌", onion: "🧅",
    papaya: "🍈", potato: "🥔", grapes: "🍇", spinach: "🥬",
    apple: "🍎", orange: "🍊", watermelon: "🍉", lemon: "🍋",
    carrot: "🥕", broccoli: "🥦", corn: "🌽", pepper: "🫑",
  };
  return map[(type ?? "").toLowerCase()] ?? "🌿";
}
