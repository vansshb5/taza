import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid, List, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import BatchCard from "../components/batches/BatchCard";
import BatchTable from "../components/batches/BatchTable";
import Loader from "../components/ui/Loader";
import EmptyState from "../components/ui/EmptyState";
import { useBatches } from "../hooks/useBatches";

/**
 * Batches list page — all data from GET /api/batches.
 * Filters by real batch.produceType field (not mock produce string).
 * Shows "No batches yet." when empty.
 */
export default function Batches() {
  const { batches, loading, error } = useBatches();
  const [view, setView] = useState("grid");
  const [produceFilter, setProduceFilter] = useState("All");

  // Derive unique produce types from actual batch data
  const produceTypes = useMemo(() => {
    const types = new Set(batches.map((b) => b.produceType).filter(Boolean));
    return Array.from(types).sort();
  }, [batches]);

  const filtered = useMemo(() => {
    if (produceFilter === "All") return batches;
    return batches.filter((b) => b.produceType === produceFilter);
  }, [batches, produceFilter]);

  return (
    <PageContainer
      title="Batches"
      subtitle={`${filtered.length} batch${filtered.length !== 1 ? "es" : ""}`}
    >
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        {/* Produce type filter — derived from real data */}
        <div className="flex gap-2 flex-wrap">
          {["All", ...produceTypes].map((p) => (
            <button
              key={p}
              onClick={() => setProduceFilter(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                produceFilter === p
                  ? "bg-brand-700 text-white border-brand-700"
                  : "bg-surface text-muted border-border hover:text-ink"
              }`}
            >
              {p === "All" ? "All" : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Grid / Table toggle */}
          <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
            <button
              onClick={() => setView("grid")}
              className={`p-1.5 rounded-md transition-colors ${
                view === "grid" ? "bg-brand-50 text-brand-700" : "text-muted"
              }`}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setView("table")}
              className={`p-1.5 rounded-md transition-colors ${
                view === "table" ? "bg-brand-50 text-brand-700" : "text-muted"
              }`}
            >
              <List size={15} />
            </button>
          </div>

          {/* Create batch shortcut */}
          <Link
            to="/inspect"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition-colors"
          >
            <Plus size={13} /> New Batch
          </Link>
        </div>
      </div>

      {loading && <Loader label="Loading batches…" />}

      {error && (
        <p className="text-sm text-red-600">
          Failed to load batches. Make sure the backend is running.
        </p>
      )}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          title="No batches yet."
          description="Create your first batch to start tracking freshness and recommendations."
        />
      )}

      <AnimatePresence mode="wait">
        {!loading && !error && filtered.length > 0 && view === "grid" && (
          <motion.div
            key="grid"
            initial="hidden"
            animate="show"
            exit={{ opacity: 0 }}
            variants={{ show: { transition: { staggerChildren: 0.05 } } }}
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5"
          >
            {filtered.map((b) => (
              <motion.div
                key={b._id}
                variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                transition={{ duration: 0.3 }}
              >
                <BatchCard batch={b} />
              </motion.div>
            ))}
          </motion.div>
        )}

        {!loading && !error && filtered.length > 0 && view === "table" && (
          <motion.div
            key="table"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <BatchTable batches={filtered} />
          </motion.div>
        )}
      </AnimatePresence>
    </PageContainer>
  );
}