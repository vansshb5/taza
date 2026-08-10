import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Loader2, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import Card, { CardHeader } from "../ui/Card";
import ActionBadge from "../recommendations/ActionBadge";
import { formatKg, formatPercent, formatCurrency } from "../../utils/formatting";
import { getBatchInsights } from "../../api/analysis";

/**
 * DecisionResultPanel
 *
 * Displays the stored result from POST /api/batches/:batchId/analyze.
 * The "decision" field on the Prediction document contains the full
 * Layer 3 deterministic decision engine output.
 *
 * Real decision shape (from Python ai/decision/schema.py DecisionResult):
 *   recommendation:
 *     primary_action  string
 *     confidence      float 0-1
 *     reasoning       string
 *     urgency         string
 *   allocations:      [{ destination, quantity_kg, action, expected_revenue, expected_profit }]
 *   impact:
 *     total_quantity_kg
 *     estimated_waste_kg
 *     estimated_waste_percent
 *     estimated_revenue
 *     estimated_profit
 *
 * For a heuristic-only prediction (no images), prediction.decision may be null —
 * in which case we fall back to the Recommendation document if provided.
 *
 * AI Insights ("Get AI Insights" button):
 *   POST /api/batches/:batchId/analyze/insights
 *   Returns: { agent_explanation, agent_notes, agent_provider, agent_model }
 *   This is OPTIONAL and never overrides the deterministic numbers above.
 */

export default function DecisionResultPanel({ prediction, batchId }) {
  const [aiInsight, setAiInsight] = useState(
    // Use stored insights if already fetched
    prediction?.aiInsights ?? null
  );
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [insightError, setInsightError] = useState(null);
  const [showFactors, setShowFactors] = useState(false);

  async function fetchInsights() {
    setLoadingInsight(true);
    setInsightError(null);
    try {
      const result = await getBatchInsights(batchId);
      setAiInsight(result);
    } catch (err) {
      setInsightError(
        err?.response?.data?.message ?? "AI insights are temporarily unavailable."
      );
    } finally {
      setLoadingInsight(false);
    }
  }

  if (!prediction) return null;

  // The decision engine result is stored in prediction.decision
  const decision = prediction.decision ?? null;
  const rec = decision?.recommendation ?? null;
  const allocations = decision?.allocations ?? [];
  const impact = decision?.impact ?? null;

  // CV result
  const cv = {
    visualClass: prediction.visualClass,
    classDistribution: prediction.classDistribution,
    freshnessScore: prediction.freshnessScore,
  };

  // Shelf-life assessment (Layer 2)
  const shelfLife = prediction.shelfLifeAssessment?.assessment ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-4"
    >
      {/* ── CV Analysis (Layer 1) ──────────────────────────────────────────── */}
      {(cv.visualClass || cv.freshnessScore != null) && (
        <Card>
          <CardHeader title="Computer Vision Analysis" subtitle="Layer 1 — freshness classification" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {cv.freshnessScore != null && (
              <Metric label="Freshness Score" value={`${cv.freshnessScore}/100`} />
            )}
            {prediction.shelfLifeDays != null && (
              <Metric label="Shelf Life" value={`${prediction.shelfLifeDays} days`} />
            )}
            {prediction.riskLevel && (
              <Metric label="Risk Level" value={prediction.riskLevel} />
            )}
            {cv.visualClass && (
              <Metric label="Visual Class" value={cv.visualClass} />
            )}
            {prediction.confidence != null && (
              <Metric label="Confidence" value={formatPercent(prediction.confidence * 100)} />
            )}
            {prediction.spoilageProbability != null && (
              <Metric
                label="Spoilage Prob."
                value={formatPercent(prediction.spoilageProbability * 100)}
              />
            )}
          </div>

          {/* Class distribution */}
          {cv.classDistribution && Object.keys(cv.classDistribution).length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">
                Class Distribution
              </p>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(cv.classDistribution).map(([cls, val]) => (
                  <div key={cls}>
                    <dt className="text-[11px] text-muted">{cls}</dt>
                    <dd className="text-sm font-mono text-ink">{formatPercent(val * 100)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </Card>
      )}

      {/* ── Shelf-Life Assessment (Layer 2) ───────────────────────────────── */}
      {shelfLife && (
        <Card>
          <CardHeader
            title="Shelf-Life Assessment"
            subtitle="Layer 2 — RAG-grounded estimate"
            action={
              <button
                onClick={() => setShowFactors((v) => !v)}
                className="text-xs text-brand-700 flex items-center gap-1 hover:underline"
              >
                Factors {showFactors ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            }
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {shelfLife.estimated_remaining_shelf_life_days != null && (
              <Metric
                label="Remaining Shelf Life"
                value={`${shelfLife.estimated_remaining_shelf_life_days} days`}
              />
            )}
            {shelfLife.estimate_range_days != null && (
              <Metric
                label="Estimate Range"
                value={`${shelfLife.estimate_range_days[0]}–${shelfLife.estimate_range_days[1]} days`}
              />
            )}
            {shelfLife.spoilage_risk && (
              <Metric label="Spoilage Risk" value={shelfLife.spoilage_risk} />
            )}
            {shelfLife.urgency && (
              <Metric label="Urgency" value={shelfLife.urgency} />
            )}
            {shelfLife.confidence != null && (
              <Metric label="Confidence" value={formatPercent(shelfLife.confidence * 100)} />
            )}
            {prediction.shelfLifeAssessment?.condition?.batch_condition && (
              <Metric
                label="Batch Condition"
                value={prediction.shelfLifeAssessment.condition.batch_condition}
              />
            )}
          </div>

          {showFactors && shelfLife.factors && shelfLife.factors.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-muted uppercase tracking-wide">Key Factors</p>
              {shelfLife.factors.map((f, i) => (
                <div
                  key={i}
                  className="text-sm text-muted border-l-2 border-brand-100 pl-3 leading-relaxed"
                >
                  {typeof f === "string" ? f : f.description ?? JSON.stringify(f)}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ── Decision Engine (Layer 3) — source of truth ────────────────────── */}
      {rec ? (
        <Card>
          <CardHeader
            title="Decision Engine"
            subtitle="Layer 3 — deterministic recommendation (source of truth)"
          />
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <ActionBadge action={mapAction(rec.primary_action)} />
              {rec.urgency && <UrgencyBadge level={rec.urgency} />}
              {rec.confidence != null && (
                <span className="text-xs text-muted">
                  Confidence: {formatPercent(rec.confidence * 100)}
                </span>
              )}
            </div>

            {rec.reasoning && (
              <p className="text-sm text-ink leading-relaxed border-l-2 border-brand-200 pl-3">
                {rec.reasoning}
              </p>
            )}

            {/* Impact summary */}
            {impact && <ImpactGrid impact={impact} />}

            {/* Allocation breakdown */}
            {allocations.length > 0 && <AllocationTable allocations={allocations} />}
          </div>
        </Card>
      ) : (
        // Heuristic-only prediction — no decision engine result
        <Card>
          <CardHeader
            title="Decision Engine"
            subtitle="Not available — no image-based analysis on file"
          />
          <p className="text-sm text-muted">
            Run "Analyze Batch" with produce images to get the full AI decision.
          </p>
        </Card>
      )}

      {/* ── AI Insights — optional explanation ────────────────────────────── */}
      <Card>
        <CardHeader
          title="AI Insights"
          subtitle="Optional explanation layer — does not override the decision above"
        />

        {insightError && (
          <div className="flex items-start gap-2 text-sm text-red-600 mb-3">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            {insightError}
          </div>
        )}

        {aiInsight && !insightError && (
          <div className="space-y-3 mb-4">
            {aiInsight.agent_explanation && (
              <p className="text-sm text-ink leading-relaxed">
                {aiInsight.agent_explanation}
              </p>
            )}
            {aiInsight.agent_notes && (
              <p className="text-xs text-muted italic">{aiInsight.agent_notes}</p>
            )}
            {(aiInsight.agent_provider || aiInsight.agent_model) && (
              <p className="text-[11px] text-muted">
                Generated by {aiInsight.agent_provider ?? ""}{" "}
                {aiInsight.agent_model ? `(${aiInsight.agent_model})` : ""}
              </p>
            )}
          </div>
        )}

        {!aiInsight && !insightError && (
          <p className="text-xs text-muted mb-3">
            AI insights provide a natural-language explanation of the decision above.
            They do not change the recommended action or any numbers.
          </p>
        )}

        <button
          onClick={fetchInsights}
          disabled={loadingInsight || !rec}
          title={!rec ? "Analyze batch with images first to enable AI Insights" : undefined}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-700 text-white text-sm font-medium hover:bg-brand-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loadingInsight ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
          {loadingInsight ? "Generating Insights…" : aiInsight ? "Refresh AI Insights" : "Get AI Insights"}
        </button>
      </Card>
    </motion.div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Maps Python decision engine primary_action strings to our ActionBadge enum keys.
 * Python returns: "SELL", "DISCOUNT", "REDISTRIBUTE", "RESCUE", "HOLD", etc.
 * Our ActionBadge expects: SELL_LOCAL | MOVE_TO_MARKET | DISCOUNT | PROCESS | REDIRECT | HOLD | URGENT_SELL
 */
function mapAction(primaryAction) {
  if (!primaryAction) return null;
  const upper = primaryAction.toUpperCase().replace(/ /g, "_");
  const MAP = {
    SELL: "SELL_LOCAL",
    SELL_LOCAL: "SELL_LOCAL",
    REDISTRIBUTE: "MOVE_TO_MARKET",
    MOVE_TO_MARKET: "MOVE_TO_MARKET",
    DISCOUNT: "DISCOUNT",
    RESCUE: "URGENT_SELL",
    URGENT_SELL: "URGENT_SELL",
    PROCESS: "PROCESS",
    REDIRECT: "REDIRECT",
    HOLD: "HOLD",
  };
  return MAP[upper] ?? upper;
}

function ImpactGrid({ impact }) {
  const items = [
    { label: "Total Quantity", value: impact.total_quantity_kg != null ? formatKg(impact.total_quantity_kg) : null },
    { label: "Est. Waste", value: impact.estimated_waste_kg != null ? formatKg(impact.estimated_waste_kg) : null },
    { label: "Waste %", value: impact.estimated_waste_percent != null ? formatPercent(impact.estimated_waste_percent) : null },
    { label: "Est. Revenue", value: impact.estimated_revenue != null ? formatCurrency(impact.estimated_revenue) : null },
    { label: "Est. Profit", value: impact.estimated_profit != null ? formatCurrency(impact.estimated_profit) : null },
  ].filter((i) => i.value !== null);

  if (items.length === 0) return null;
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {items.map((item) => (
        <div key={item.label} className="bg-bg rounded-lg p-3">
          <dt className="text-[11px] text-muted uppercase tracking-wide">{item.label}</dt>
          <dd className="text-sm font-mono font-semibold text-ink mt-0.5">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function AllocationTable({ allocations }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">
        Allocation Plan
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted border-b border-border">
              <th className="px-3 py-2">Destination</th>
              <th className="px-3 py-2">Quantity</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {allocations.map((a, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-3 py-2 font-medium text-ink">
                  {a.destination ?? "—"}
                </td>
                <td className="px-3 py-2 font-mono text-ink">
                  {a.quantity_kg != null ? formatKg(a.quantity_kg) : "—"}
                </td>
                <td className="px-3 py-2 text-muted">
                  <ActionBadge action={mapAction(a.action)} />
                </td>
                <td className="px-3 py-2 font-mono text-ink">
                  {a.expected_revenue != null ? formatCurrency(a.expected_revenue) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="bg-bg rounded-lg p-3">
      <dt className="text-[11px] text-muted uppercase tracking-wide">{label}</dt>
      <dd className="text-sm font-mono font-semibold text-ink mt-0.5">{value}</dd>
    </div>
  );
}

function UrgencyBadge({ level }) {
  const tones = {
    LOW: "text-brand-700 bg-brand-50",
    MEDIUM: "text-amber-700 bg-amber-50",
    HIGH: "text-orange-700 bg-orange-50",
    CRITICAL: "text-red-700 bg-red-50",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${tones[level?.toUpperCase()] ?? "text-muted bg-bg"}`}
    >
      {level}
    </span>
  );
}
