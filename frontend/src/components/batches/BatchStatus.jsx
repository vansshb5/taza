import Badge from "../ui/Badge";

/**
 * Displays a risk tier badge based on the real spoilageProbability (0–1)
 * from the backend Batch/Prediction model.
 *
 * Risk tiers (match backend Prediction.riskLevel enum):
 *   LOW    < 0.2
 *   MEDIUM < 0.45
 *   HIGH   < 0.7
 *   CRITICAL >= 0.7
 */
function spoilageRiskTier(prob) {
  if (prob == null) return null;
  if (prob < 0.2) return "LOW";
  if (prob < 0.45) return "MEDIUM";
  if (prob < 0.7) return "HIGH";
  return "CRITICAL";
}

const TIER_TONE = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "high",
};

const TIER_LABEL = {
  LOW: "Low Risk",
  MEDIUM: "Medium Risk",
  HIGH: "High Risk",
  CRITICAL: "Critical",
};

export default function BatchStatus({ spoilageProb }) {
  if (spoilageProb == null) {
    return (
      <span className="text-xs text-muted italic">No data</span>
    );
  }
  const tier = spoilageRiskTier(spoilageProb);
  return (
    <Badge tone={TIER_TONE[tier]}>
      {TIER_LABEL[tier]}
    </Badge>
  );
}
