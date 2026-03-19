import { useEffect, useState } from "react";
import { logsAPI } from "../services/api.js";

const ACTION_ICONS = {
  submitted: { icon: "bi-send", color: "var(--primary)" },
  ocr_processed: { icon: "bi-file-earmark-text", color: "var(--info)" },
  face_matched: { icon: "bi-person-bounding-box", color: "var(--info)" },
  liveness_checked: { icon: "bi-camera-video", color: "var(--info)" },
  status_changed: { icon: "bi-arrow-left-right", color: "var(--warning)" },
  reviewed: { icon: "bi-clipboard-check", color: "var(--success)" },
  document_uploaded: { icon: "bi-upload", color: "var(--primary)" },
};

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    logsAPI.list()
      .then(({ data }) => setLogs(data.results || data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Audit Logs</h1>
          <p>Complete trail of all KYC verification activities</p>
        </div>
        <button className="btn btn-outline" onClick={() => window.location.reload()}>
          <i className="bi bi-arrow-clockwise" /> Refresh
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th>Application / User</th>
              <th>Performed By</th>
              <th>IP Address</th>
              <th>Timestamp</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6}><div className="loading-center"><span className="spinner" /></div></td></tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="empty-state">
                    <i className="bi bi-journal-x" /><p>No logs found</p>
                  </div>
                </td>
              </tr>
            ) : logs.map((log) => {
              const meta = ACTION_ICONS[log.action] || { icon: "bi-dot", color: "var(--text-muted)" };
              return (
                <tr key={log.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                        background: `${meta.color}22`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, color: meta.color,
                      }}>
                        <i className={`bi ${meta.icon}`} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>
                        {log.action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                      </span>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {log.application || "—"}
                  </td>
                  <td className="td-name" style={{ fontSize: 12 }}>{log.performed_by_name}</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
                    {log.ip_address || "—"}
                  </td>
                  <td style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    {new Date(log.timestamp).toLocaleString("en-KE")}
                  </td>
                  <td>
                    {log.details && Object.keys(log.details).length > 0 ? (
                      <code style={{ fontSize: 10, background: "var(--bg)", padding: "2px 6px", borderRadius: 4, color: "var(--text-secondary)" }}>
                        {JSON.stringify(log.details).slice(0, 60)}{JSON.stringify(log.details).length > 60 ? "…" : ""}
                      </code>
                    ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}