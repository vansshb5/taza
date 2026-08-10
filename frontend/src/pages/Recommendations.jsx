import { motion } from "framer-motion";
import { ListChecks, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import RecommendationCard from "../components/recommendations/RecommendationCard";
import Loader from "../components/ui/Loader";
import EmptyState from "../components/ui/EmptyState";
import { useRecommendations } from "../hooks/useRecommendations";

/**
 * Recommendations page.
 * Fetches real per-batch recommendations from Express/MongoDB.
 * Never uses mock data or hardcoded recommendations.
 */
export default function Recommendations() {
  const { recommendations, loading, error } = useRecommendations();

  return (
    <PageContainer
      title="Recommendations"
      subtitle="Actionable decisions from the AI decision engine"
    >
      {loading && <Loader label="Loading recommendations…" />}

      {error && (
        <p className="text-sm text-red-600">
          Failed to load recommendations. Make sure the backend is running.
        </p>
      )}

      {!loading && !error && recommendations.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <EmptyState
            icon={ListChecks}
            title="No recommendations yet."
            description="Run an inspection on a batch to generate an AI-powered recommendation."
          />
          <Link
            to="/inspect"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-700 text-white rounded-xl text-sm font-semibold hover:bg-brand-900 transition-colors"
          >
            <Plus size={16} />
            Create & Inspect Batch
          </Link>
        </div>
      )}

      {!loading && !error && recommendations.length > 0 && (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.08 } } }}
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
        >
          {recommendations.map((rec) => (
            <motion.div
              key={rec._id}
              variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.35 }}
            >
              <RecommendationCard rec={rec} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </PageContainer>
  );
}
