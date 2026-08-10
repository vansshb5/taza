import { useEffect, useState } from "react";
import { getBatches } from "../api/batches";

export function useBatches() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getBatches()
      .then((data) => {
        if (active) setBatches(Array.isArray(data) ? data : []);
      })
      .catch((err) => active && setError(err))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return { batches, loading, error };
}