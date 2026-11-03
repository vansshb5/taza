import { useTranslation } from "react-i18next";
import { ArrowRightCircle, Truck, Tag, Recycle, Eye, Zap } from "lucide-react";

const ACTION_META = {
  "Sell locally": { icon: ArrowRightCircle, tone: "text-brand-700 bg-brand-50" },
  "Ship to high-demand location": { icon: Truck, tone: "text-brand-700 bg-brand-50" },
  "Discount now": { icon: Tag, tone: "text-risk-medium bg-[#FBF1DF]" },
  "Redirect to processing": { icon: Recycle, tone: "text-risk-high bg-[#FBEAE6]" },
  "Redirect to alternative channel": { icon: Recycle, tone: "text-risk-high bg-[#FBEAE6]" },
  "Urgent sell immediately": { icon: Zap, tone: "text-risk-high bg-[#FBEAE6]" },
  "Hold & monitor": { icon: Eye, tone: "text-muted bg-bg" },
  Monitor: { icon: Eye, tone: "text-muted bg-bg" },
};

// "Move to <market>" is produced for MOVE_TO_MARKET with a target market.
function getMeta(action) {
  if (ACTION_META[action]) return ACTION_META[action];
  if (typeof action === "string" && action.startsWith("Move to ")) {
    return ACTION_META["Ship to high-demand location"];
  }
  return ACTION_META.Monitor;
}

export default function ActionBadge({ action }) {
  const { t } = useTranslation();
  const meta = getMeta(action);
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${meta.tone}`}>
      <Icon size={13} />
      {t(`common.actions.${action}`, action)}
    </span>
  );
}
