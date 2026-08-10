import { useEffect, useState } from "react";
import { getDashboardOverview, getUrgentBatches } from "../api/dashboard";

/**
 * Fetches real dashboard data from:
 *   GET /api/dashboard/overview  → { wasteMetrics, inventoryByStatus, recentRecommendations }
 *   GET /api/dashboard/urgent    → Batch[] sorted by urgency
 */
export function useDashboard() {
  const [overview, setOverview] = useState(null);
  const [urgentBatches, setUrgentBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([getDashboardOverview(), getUrgentBatches()])
      .then(([ov, urgent]) => {
        if (!active) return;
        setOverview(ov ?? null);
        setUrgentBatches(Array.isArray(urgent) ? urgent : []);
      })
      .catch((err) => active && setError(err))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  // Derived convenience accessors
  const wasteMetrics = overview?.wasteMetrics ?? null;
  const inventoryByStatus = overview?.inventoryByStatus ?? {};
  const recentRecommendations = overview?.recentRecommendations ?? {};

  return {
    overview,
    wasteMetrics,
    inventoryByStatus,
    recentRecommendations,
    urgentBatches,
    loading,
    error,
  };
}
