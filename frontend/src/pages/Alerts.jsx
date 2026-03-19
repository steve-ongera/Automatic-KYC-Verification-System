import { useEffect, useState } from "react";
import { alertsAPI } from "../services/api.js";

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("unresolved");
  const [resolving, setResolving] = useState(null);

  const load = () => {
    setLoading(true);
    alertsAPI.list(filter === "unresolved" ? { unresolved: true } : {})
      .then(({ data }) => setAlerts(data.results || data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  const resolve = async (id) => {
    setResolving(id);
    try {
      await alertsAPI.resolve(id);
      load();
    } catch (e) {
      console.error(e);
    } finally {
      setResolving(null);
    }
  };

  const severityIcon = { info: "bi-info-circle", warning: "bi-exclamation-triangle", critical: "bi-x-octagon-fill" };

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>System Alerts</h1>
          <p>Fraud detections, face mismatches, and system warnings</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select
            className="form-control"
            style={{ width: "auto" }}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="unresolved">Unresolved Only</option>
            <option value="all">All Alerts</option>
          </select>
          <button className="btn btn-outline" onClick={load}><i className="bi bi-arrow-clockwise" /></button>
        </div>
      </div>

      {loading ? (
        <div className="loading-center"><span className="spinner spinner-lg" /></div>
      ) : alerts.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <i className="bi bi-bell-slash" />
            <p>No alerts found</p>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="card"
              style={{ borderLeft: `4px solid ${alert.severity === "critical" ? "var(--danger)" : alert.severity === "warning" ? "var(--warning)" : "var(--info)"}` }}
            >
              <div className="card-body" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div style={{
                  width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
                  background: alert.severity === "critical" ? "var(--danger-light)" : alert.severity === "warning" ? "var(--warning-light)" : "var(--info-light)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18,
                  color: alert.severity === "critical" ? "var(--danger)" : alert.severity === "warning" ? "var(--warning)" : "var(--info)",
                }}>
                  <i className={`bi ${severityIcon[alert.severity]}`} />
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                    <span className={`status-badge severity-${alert.severity}`}>
                      {alert.severity.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                      {alert.alert_type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                    {alert.is_resolved && (
                      <span className="status-badge status-approved">
                        <i className="bi bi-check-circle" /> Resolved
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>{alert.message}</p>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {alert.application_user && (
                      <span><i className="bi bi-person" /> {alert.application_user}</span>
                    )}
                    <span><i className="bi bi-clock" /> {new Date(alert.created_at).toLocaleString()}</span>
                    {alert.resolved_by_name && (
                      <span><i className="bi bi-check" /> Resolved by {alert.resolved_by_name}</span>
                    )}
                  </div>
                </div>

                {!alert.is_resolved && (
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => resolve(alert.id)}
                    disabled={resolving === alert.id}
                  >
                    {resolving === alert.id ? <span className="spinner" /> : <i className="bi bi-check-lg" />}
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}