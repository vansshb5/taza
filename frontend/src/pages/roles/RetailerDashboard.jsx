import { useNavigate } from "react-router-dom";
import { useBatches } from "../../hooks/useBatches";
import { useDashboard } from "../../hooks/useDashboard";
import { formatKg } from "../../utils/formatting";
import { useRecommendations } from "../../hooks/useRecommendations";

export default function RetailerDashboard() {
  const navigate = useNavigate();
  const { batches, loading } = useBatches();
  const { wasteMetrics } = useDashboard();
  const { recommendations } = useRecommendations();

  return (
    <div className="role-page">
      <div className="role-header">
        <div>
          <span className="role-badge">🛒 Retailer</span>
          <h1>Good morning, Retailer 👋</h1>
          <p>Manage stock, discounts and sourcing decisions.</p>
        </div>
      </div>

      <div className="kpi-grid">
        <KPI value={loading ? "…" : wasteMetrics?.totalBatches ?? 0} label="Active Batches" />
        <KPI value={loading ? "…" : (wasteMetrics?.totalInventoryKg ?? 0) + " kg"} label="Total Stock" />
        <KPI value={loading ? "…" : wasteMetrics?.atRiskBatchCount ?? 0} label="At-Risk" />
        <KPI value={loading ? "…" : recommendations.length} label="Pending Decisions" />
      </div>

      <div className="two-column">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Current Stock</h2>
              <p>Real-time batch inventory</p>
            </div>
            <button onClick={() => navigate("/batches")}>View All</button>
          </div>
          {loading ? (
            <p style={{ color: "#5b6b60", fontSize: 14 }}>Loading…</p>
          ) : batches.length === 0 ? (
            <p style={{ color: "#5b6b60", fontSize: 14 }}>No batches yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Location</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {batches.slice(0, 6).map((b) => (
                  <tr key={b._id} style={{ cursor: "pointer" }} onClick={() => navigate(`/batches/${b._id}`)}>
                    <td><strong>{b.batchCode ?? b._id}</strong></td>
                    <td>{b.productName}</td>
                    <td>{formatKg(b.quantity)}</td>
                    <td>{b.currentLocation}</td>
                    <td><span className="status">{b.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel ai-panel">
          <span className="ai-icon">✦</span>
          <h2>AI Pricing Advisor</h2>
          <p>
            View discount and sell recommendations from the AI decision engine — based on
            real freshness, shelf-life, and demand analysis.
          </p>
          <button onClick={() => navigate("/recommendations")}>
            View Recommendations →
          </button>
        </div>
      </div>

      <div className="panel">
        <h2>Quick Actions</h2>
        <div className="action-grid">
          <Action text="Inspect Produce" onClick={() => navigate("/inspect")} />
          <Action text="All Batches" onClick={() => navigate("/batches")} />
          <Action text="Recommendations" onClick={() => navigate("/recommendations")} />
          <Action text="Traceability" onClick={() => navigate("/traceability")} />
        </div>
      </div>
    </div>
  );
}

function KPI({ value, label }) {
  return <div className="kpi-card"><strong>{value}</strong><span>{label}</span></div>;
}
function Action({ text, onClick }) {
  return <button className="action-card" onClick={onClick}><span>{text}</span><span>→</span></button>;
}