import { motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { PIPELINE_STEPS } from "../../hooks/useInspectionFlow";

/**
 * Visual pipeline progress indicator for the inspection wizard.
 * Only marks a step complete when the corresponding API has succeeded.
 * Never fabricates status.
 */
export default function PipelineProgress({ currentStep, completedSteps, failedStep }) {
  return (
    <div className="space-y-3">
      {PIPELINE_STEPS.map((step) => {
        const isDone = completedSteps.includes(step.key);
        const isActive = currentStep === step.key;
        const isFailed = failedStep === step.key;

        let Icon = null;
        let iconClass = "";
        let labelClass = "text-muted";

        if (isFailed) {
          Icon = AlertCircle;
          iconClass = "text-red-500";
          labelClass = "text-red-600 font-medium";
        } else if (isDone) {
          Icon = CheckCircle2;
          iconClass = "text-brand-700";
          labelClass = "text-ink font-medium";
        } else if (isActive) {
          Icon = Loader2;
          iconClass = "text-brand-700 animate-spin";
          labelClass = "text-ink font-medium";
        }

        return (
          <motion.div
            key={step.key}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            {Icon ? (
              <Icon size={18} className={iconClass} />
            ) : (
              <div className="w-[18px] h-[18px] rounded-full border-2 border-border" />
            )}
            <span className={`text-sm ${labelClass}`}>{step.label}</span>
          </motion.div>
        );
      })}
    </div>
  );
}
