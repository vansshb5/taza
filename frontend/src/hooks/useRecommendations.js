import { useEffect, useState } from "react";
import { getLatestRecommendation } from "../api/recommendations";
import { getBatches } from "../api/batches";

/**
 * Fetches all batches, then fetches the latest recommendation for each one
 * that has had a prediction run. Returns a flat list of recommendations with
 * their associated batch info merged in.
 *
 * Only real data from Express/MongoDB — no mock values.
 */
export function useRecommendations() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);

    getBatches()
      .then(async (batches) => {
        if (!active) return;

        // Only query recommendations for batches that have had predictions run
        const batchesWithPredictions = (batches ?? []).filter(
          (b) => b.latestPredictionAt != null
        );

        const settled = await Promise.allSettled(
          batchesWithPredictions.map(async (batch) => {
            try {
              const rec = await getLatestRecommendation(batch._id);
              if (!rec) return null;
              return { ...rec, _batchRef: batch };
            } catch {
              return null;
            }
          })
        );

        if (!active) return;

        const results = settled
          .filter((r) => r.status === "fulfilled" && r.value != null)
          .map((r) => r.value);

        setRecommendations(results);
      })
      .catch((err) => active && setError(err))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, []);

  return { recommendations, loading, error };
}
