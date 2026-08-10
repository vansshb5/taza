import { ListChecks } from "lucide-react";
import Card, { CardHeader } from "../ui/Card";

/**
 * Displays the recentRecommendations summary from GET /api/dashboard/overview.
 *
 * Real shape (waste.service.js getRecentRecommendationSummary):
 *   { SELL_LOCAL: N, DISCOUNT: N, MOVE_TO_MARKET: N, ... }
 *   Keys are the actual actionType enum values from Recommendation.js.
 */
const ACTION_LABELS = {
  SELL_LOCAL: "Sell Locally",
  MOVE_TO_MARKET: "Move to Market",
  DISCOUNT: "Apply Discount",
  PROCESS: "Process",
  REDIRECT: "Redirect",
  HOLD: "Hold & Monitor",
  URGENT_SELL: "Urgent Sell",
};

export default function RecentActivity({ recentRecommendations }) {
  const entries = Object.entries(recentRecommendations ?? {}).sort(
    ([, a], [, b]) => b - a
  );

  return (
    <Card>
      <CardHeader
        title="Recent Recommendations"
        subtitle="Last 7 days by action type"
      />
      {entries.length === 0 ? (
        <p className="text-sm text-muted py-2">No recommendations yet.</p>
      ) : (
        <ul className="space-y-2 mt-1">
          {entries.map(([action, count]) => (
            <li key={action} className="flex items-center justify-between">
              <span className="text-sm text-ink flex items-center gap-2">
                <ListChecks size={13} className="text-brand-700 shrink-0" />
                {ACTION_LABELS[action] ?? action}
              </span>
              <span className="text-sm font-mono font-semibold text-ink">
                {count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
