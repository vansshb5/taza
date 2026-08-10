import { useTranslation } from "react-i18next";
import PageContainer from "../components/layout/PageContainer";
import OverviewCards from "../components/dashboard/OverviewCards";
import PriorityBatches from "../components/dashboard/PriorityBatches";
import RecentActivity from "../components/dashboard/RecentActivity";
import Loader from "../components/ui/Loader";
import { useDashboard } from "../hooks/useDashboard";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";

/**
 * Dashboard page — all data from real Express/MongoDB APIs:
 *   GET /api/dashboard/overview  → wasteMetrics, inventoryByStatus, recentRecommendations
 *   GET /api/dashboard/urgent    → urgent batches
 *
 * If no data exists, shows "No batches yet." — never uses mock fallbacks.
 */
export default function Dashboard() {
  const { t } = useTranslation();
  const {
    wasteMetrics,
    inventoryByStatus,
    recentRecommendations,
    urgentBatches,
    loading,
    error,
  } = useDashboard();

  if (loading) {
    return (
      <PageContainer title={t("dashboard.title")} subtitle={t("dashboard.subtitle")}>
        <Loader label="Loading dashboard…" />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer title={t("dashboard.title")} subtitle={t("dashboard.subtitle")}>
        <p className="text-sm text-red-600">
          Unable to load dashboard data. Make sure the backend is running.
        </p>
      </PageContainer>
    );
  }

  const hasData = (wasteMetrics?.totalBatches ?? 0) > 0;

  return (
    <PageContainer title={t("dashboard.title")} subtitle={t("dashboard.subtitle")}>
      <div className="space-y-5">
        {/* Real overview KPIs */}
        <OverviewCards
          wasteMetrics={wasteMetrics}
          inventoryByStatus={inventoryByStatus}
        />

        {!hasData ? (
          <NoBatchesState />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {/* Priority batches (left, 2/3 width) */}
            <div className="xl:col-span-2">
              <PriorityBatches batches={urgentBatches} />
            </div>

            {/* Recent recommendations summary (right, 1/3 width) */}
            <div className="space-y-5">
              <RecentActivity recentRecommendations={recentRecommendations} />
              {inventoryByStatus && Object.keys(inventoryByStatus).length > 0 && (
                <InventoryByStatus data={inventoryByStatus} />
              )}
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}

function NoBatchesState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <p className="text-2xl font-display font-semibold text-ink">No batches yet.</p>
      <p className="text-sm text-muted max-w-sm">
        Create your first batch to start tracking freshness, shelf life, and
        actionable recommendations.
      </p>
      <Link
        to="/inspect"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-700 text-white rounded-xl text-sm font-semibold hover:bg-brand-900 transition-colors"
      >
        <Plus size={16} />
        Create Batch
      </Link>
    </div>
  );
}

function InventoryByStatus({ data }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <p className="text-sm font-medium text-ink mb-3">Inventory by Status</p>
      <dl className="space-y-2">
        {Object.entries(data).map(([status, info]) => (
          <div key={status} className="flex items-center justify-between">
            <dt className="text-xs text-muted">{status.replace(/_/g, " ")}</dt>
            <dd className="text-xs font-mono font-semibold text-ink">
              {info.count} batch{info.count !== 1 ? "es" : ""} ·{" "}
              {info.totalQuantityKg} kg
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
