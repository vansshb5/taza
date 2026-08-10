import { useNavigate } from "react-router-dom";
import { useBatches } from "../../hooks/useBatches";
import { useDashboard } from "../../hooks/useDashboard";
import { formatKg, formatDate } from "../../utils/formatting";

export default function FarmerDashboard() {
  const navigate = useNavigate();
  const { batches, loading } = useBatches();
  const { wasteMetrics } = useDashboard();

  return (
    <div className="role-page">
      <div className="role-header">
        <div>
          <span className="role-badge">🌾 Farmer</span>
          <h1>Good morning, Farmer 👋</h1>
          <p>Manage your crops, harvests and farm produce.</p>
        </div>
      </div>

      {/* KPIs — real data only */}
      <div className="kpi-grid">
        <KPI
          value={loading ? "…" : wasteMetrics?.totalBatches ?? 0}
          label="Total Batches"
        />
        <KPI
          value={loading ? "…" : (wasteMetrics?.totalInventoryKg ?? 0) + " kg"}
          label="Total Inventory"
        />
        <KPI
          value={loading ? "…" : wasteMetrics?.atRiskBatchCount ?? 0}
          label="At-Risk Batches"
        />
        <KPI
          value={loading ? "…" : wasteMetrics?.criticalBatchCount ?? 0}
          label="Critical Batches"
        />
      </div>

      <div className="two-column">
        {/* Batch list */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>My Batches</h2>
              <p>Real-time batch status</p>
            </div>
            <button onClick={() => navigate("/inspect")}>
              + New Batch
            </button>
          </div>

          {loading ? (
            <p style={{ color: "#5b6b60", fontSize: 14 }}>Loading…</p>
          ) : batches.length === 0 ? (
            <p style={{ color: "#5b6b60", fontSize: 14 }}>
              No batches yet. Create your first batch to start tracking.
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Produce</th>
                  <th>Quantity</th>
                  <th>Harvest Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {batches.slice(0, 6).map((b) => (
                  <tr
                    key={b._id}
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate(`/batches/${b._id}`)}
                  >
                    <td>
                      <strong>{b.batchCode ?? b._id}</strong>
                    </td>
                    <td>{b.productName}</td>
                    <td>{formatKg(b.quantity)}</td>
                    <td>{formatDate(b.harvestDate)}</td>
                    <td>
                      <span className="status">{b.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Quick nav */}
        <div className="panel ai-panel">
          <span className="ai-icon">📦</span>
          <h2>Quick Actions</h2>
          <p>
            Navigate to the key tools to manage your produce, inspect quality,
            and view AI-powered recommendations.
          </p>
          <button onClick={() => navigate("/recommendations")}>
            View Recommendations →
          </button>
        </div>
      </div>

      <div className="panel">
        <h2>Quick Actions</h2>
        <div className="action-grid">
          <Action text="Create New Batch" onClick={() => navigate("/inspect")} />
          <Action text="View All Batches" onClick={() => navigate("/batches")} />
          <Action text="Recommendations" onClick={() => navigate("/recommendations")} />
          <Action text="Traceability" onClick={() => navigate("/traceability")} />
        </div>
      </div>
    </div>
  );
}

function KPI({ value, label }) {
  return (
    <div className="kpi-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Action({ text, onClick }) {
  return (
    <button className="action-card" onClick={onClick}>
      <span>{text}</span>
      <span>→</span>
    </button>
  );
}