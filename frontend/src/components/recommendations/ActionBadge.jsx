import {
  ArrowRightCircle,
  Truck,
  Tag,
  Recycle,
  Eye,
  AlertTriangle,
  ShoppingCart,
  RefreshCw,
} from "lucide-react";

/**
 * Maps real backend actionType enums to display metadata.
 * Enums from Recommendation.js:
 *   SELL_LOCAL | MOVE_TO_MARKET | DISCOUNT | PROCESS | REDIRECT | HOLD | URGENT_SELL
 */
const ACTION_META = {
  SELL_LOCAL: {
    label: "Sell Locally",
    icon: ArrowRightCircle,
    tone: "text-brand-700 bg-brand-50",
  },
  MOVE_TO_MARKET: {
    label: "Move to Market",
    icon: Truck,
    tone: "text-brand-700 bg-brand-50",
  },
  DISCOUNT: {
    label: "Apply Discount",
    icon: Tag,
    tone: "text-risk-medium bg-[#FBF1DF]",
  },
  PROCESS: {
    label: "Process / Value-Add",
    icon: Recycle,
    tone: "text-risk-high bg-[#FBEAE6]",
  },
  REDIRECT: {
    label: "Redirect",
    icon: RefreshCw,
    tone: "text-risk-high bg-[#FBEAE6]",
  },
  HOLD: {
    label: "Hold & Monitor",
    icon: Eye,
    tone: "text-muted bg-bg",
  },
  URGENT_SELL: {
    label: "Urgent Sell",
    icon: AlertTriangle,
    tone: "text-red-700 bg-red-50",
  },
  // Fallback for unknown/future enums
  DEFAULT: {
    label: "Action Required",
    icon: ShoppingCart,
    tone: "text-muted bg-bg",
  },
};

export default function ActionBadge({ action }) {
  const meta = ACTION_META[action] ?? ACTION_META.DEFAULT;
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${meta.tone}`}
    >
      <Icon size={13} />
      {meta.label}
    </span>
  );
}
