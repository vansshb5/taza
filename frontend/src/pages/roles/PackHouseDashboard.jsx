import { useNavigate } from "react-router-dom";
import { useBatches } from "../../hooks/useBatches";
import { useDashboard } from "../../hooks/useDashboard";
import { formatKg } from "../../utils/formatting";

export default function PackHouseDashboard() {
  const navigate = useNavigate();
  const { batches, loading } = useBatches();
  const { wasteMetrics } = useDashboard();

  return (
    <div className="role-page">
      <div className="role-header">
        <div>
          <span className="role-badge">📦 Pack House</span>
          <h1>Good morning, Pack House 👋</h1>
          <p>Sort, grade and prepare fresh produce for the next stage.</p>
        </div>
      </div>

      <div className="kpi-grid">
        <KPI value={loading ? "…" : wasteMetrics?.totalBatches ?? 0} label="Incoming Batches" />
        <KPI value={loading ? "…" : (wasteMetrics?.totalInventoryKg ?? 0) + " kg"} label="Total Volume" />
        <KPI value={loading ? "…" : wasteMetrics?.atRiskBatchCount ?? 0} label="At-Risk" />
        <KPI value={loading ? "…" : wasteMetrics?.criticalBatchCount ?? 0} label="Critical" />
      </div>

      <div className="two-column">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Incoming Batches</h2>
              <p>Batches awaiting grading and packing</p>
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
                  <th>Qty</th>
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
          <h2>AI Quality Assessment</h2>
          <p>Run AI-powered freshness and shelf-life analysis on any batch.</p>
          <button onClick={() => navigate("/inspect")}>Inspect Produce →</button>
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