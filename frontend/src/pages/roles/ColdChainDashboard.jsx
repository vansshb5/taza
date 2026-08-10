import { useNavigate } from "react-router-dom";
import { useBatches } from "../../hooks/useBatches";
import { useDashboard } from "../../hooks/useDashboard";
import { formatKg } from "../../utils/formatting";

export default function ColdChainDashboard() {
  const navigate = useNavigate();
  const { batches, loading } = useBatches();
  const { wasteMetrics } = useDashboard();

  // Only show batches that have temperature data
  const tempBatches = batches.filter((b) => b.storageTemperatureCelsius != null);

  return (
    <div className="role-page">
      <div className="role-header">
        <div>
          <span className="role-badge">❄️ Cold Chain</span>
          <h1>Good morning, Cold Chain 👋</h1>
          <p>Monitor temperature, humidity and cold-chain movement.</p>
        </div>
      </div>

      <div className="kpi-grid">
        <KPI value={loading ? "…" : wasteMetrics?.totalBatches ?? 0} label="Active Batches" />
        <KPI value={loading ? "…" : (wasteMetrics?.totalInventoryKg ?? 0) + " kg"} label="Total Volume" />
        <KPI value={loading ? "…" : tempBatches.length} label="With Temp Data" />
        <KPI value={loading ? "…" : wasteMetrics?.atRiskBatchCount ?? 0} label="At-Risk" />
      </div>

      <div className="two-column">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Cold Storage Batches</h2>
              <p>Batches with recorded temperature data</p>
            </div>
            <button onClick={() => navigate("/batches")}>View All</button>
          </div>
          {loading ? (
            <p style={{ color: "#5b6b60", fontSize: 14 }}>Loading…</p>
          ) : tempBatches.length === 0 ? (
            <p style={{ color: "#5b6b60", fontSize: 14 }}>
              No batches with temperature data yet. Add storage conditions when creating a batch.
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Temp (°C)</th>
                  <th>Humidity (%)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tempBatches.slice(0, 6).map((b) => (
                  <tr key={b._id} style={{ cursor: "pointer" }} onClick={() => navigate(`/batches/${b._id}`)}>
                    <td><strong>{b.batchCode ?? b._id}</strong></td>
                    <td>{b.productName}</td>
                    <td>{formatKg(b.quantity)}</td>
                    <td>{b.storageTemperatureCelsius ?? "—"}</td>
                    <td>{b.storageHumidityPercent ?? "—"}</td>
                    <td><span className="status">{b.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel ai-panel">
          <span className="ai-icon">❄</span>
          <h2>Temperature Alerts</h2>
          <p>
            Temperature monitoring is based on stored batch conditions. Run AI
            analysis to assess shelf-life impact of current storage.
          </p>
          <button onClick={() => navigate("/inspect")}>Inspect Batch →</button>
        </div>
      </div>

      <div className="panel">
        <h2>Quick Actions</h2>
        <div className="action-grid">
          <Action text="Create Batch" onClick={() => navigate("/inspect")} />
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