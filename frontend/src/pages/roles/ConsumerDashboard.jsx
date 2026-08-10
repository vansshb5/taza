import { useNavigate } from "react-router-dom";

export default function ConsumerDashboard() {
  const navigate = useNavigate();

  return (
    <div className="role-page">
      <div className="role-header">
        <div>
          <span className="role-badge">🧺 Consumer</span>
          <h1>Welcome to Taza 👋</h1>
          <p>Track the freshness and origin of your produce.</p>
        </div>
      </div>

      <div className="two-column">
        <div className="panel">
          <h2>Scan Produce</h2>
          <p>
            Scan a QR code on your produce packaging to view its complete
            freshness history, origin, and supply-chain journey.
          </p>
          <div style={{ marginTop: 20 }}>
            <button
              style={{
                background: "#2f7d5a",
                color: "white",
                padding: "12px 20px",
                borderRadius: 10,
                border: "none",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
              onClick={() => navigate("/traceability")}
            >
              Scan QR Code →
            </button>
          </div>
        </div>

        <div className="panel ai-panel">
          <span className="ai-icon">✦</span>
          <h2>Freshness Guarantee</h2>
          <p>
            Every batch in the Taza system is analysed by AI for freshness and
            shelf life. Ask your retailer or scan the QR code to see the full report.
          </p>
        </div>
      </div>
    </div>
  );
}