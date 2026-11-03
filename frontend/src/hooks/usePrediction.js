import { useRef, useState } from "react";
import { getApiErrorMessage } from "../api/client";
import { analyzeBatchImages, getBatchAiInsights } from "../api/predictions";

export function usePrediction() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Ref guard: state updates are async, so a fast double-click could otherwise
  // start two analyses (and create duplicate records) before `loading` is true.
  const inFlight = useRef(false);
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState(null);

  async function runInspection(batchId, files, storage) {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    setResult(null);
    setInsights(null);
    try {
      const data = await analyzeBatchImages(batchId, files, storage);
      setResult(data);
    } catch (err) {
      setError(new Error(getApiErrorMessage(err, "The AI analysis could not be completed.")));
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }

  async function requestInsights(batchId) {
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const data = await getBatchAiInsights(batchId);
      setInsights(data);
    } catch (err) {
      setInsightsError(new Error(getApiErrorMessage(err, "Could not load AI insights.")));
    } finally {
      setInsightsLoading(false);
    }
  }

  function reset() {
    setResult(null);
    setError(null);
    setInsights(null);
    setInsightsError(null);
  }

  return {
    result,
    loading,
    error,
    runInspection,
    reset,
    insights,
    insightsLoading,
    insightsError,
    requestInsights,
  };
}
