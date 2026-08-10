import { useEffect } from "react";
import AnimatedPage from "./AnimatedPage";
import { usePageHeader } from "../../context/PageHeaderContext";

export default function PageContainer({ title, subtitle, action, centerHeader = false, children }) {
  const { setHeader } = usePageHeader();

  useEffect(() => {
    setHeader(title, subtitle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, subtitle]);

  return (
    <AnimatedPage>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {(title || subtitle || action) && (
          <div
            className={`flex items-start justify-between gap-4 ${
              centerHeader ? "flex-col items-center text-center max-w-4xl mx-auto" : ""
            }`}
          >
            <div className={centerHeader ? "flex flex-col items-center text-center" : ""}>
              {title && <h1 className="text-2xl sm:text-3xl font-bold font-display text-ink">{title}</h1>}
              {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
            </div>
            {action && <div>{action}</div>}
          </div>
        )}
        {children}
      </div>
    </AnimatedPage>
  );
}
