import { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { kycAPI } from "../services/api.js";

const STATUS_OPTIONS = ["", "pending", "under_review", "approved", "rejected", "resubmit"];

function StatusBadge({ status }) {
  const labels = {
    pending: "Pending",
    under_review: "Under Review",
    approved: "Approved",
    rejected: "Rejected",
    resubmit: "Resubmit",
  };
  return <span className={`status-badge status-${status}`}>{labels[status] || status}</span>;
}

function ScorePill({ score, passed }) {
  if (score == null) return <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>;
  const pct = Math.round(score * 100);
  const color = passed ? "var(--success)" : "var(--danger)";
  return (
    <span style={{
      background: passed ? "var(--success-light)" : "var(--danger-light)",
      color, fontWeight: 600, fontSize: 11,
      padding: "2px 8px", borderRadius: 20,
    }}>
      {pct}% {passed ? "✓" : "✗"}
    </span>
  );
}

export default function Applications() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 20;

  const fetchApps = useCallback(() => {
    setLoading(true);
    kycAPI.list({ status: statusFilter || undefined, search: search || undefined, page })
      .then(({ data }) => {
        setApps(data.results || data);
        setTotalCount(data.count || (data.results || data).length);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [statusFilter, search, page]);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchApps();
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>KYC Applications</h1>
          <p>{totalCount} total applications</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <form onSubmit={handleSearch} style={{ display: "flex", gap: 8, flex: 1, minWidth: 200 }}>
            <div className="input-group" style={{ flex: 1 }}>
              <i className="bi bi-search input-icon" />
              <input
                type="text"
                className="form-control"
                placeholder="Search by name, email, document number…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary">
              <i className="bi bi-search" /> Search
            </button>
          </form>

          <select
            className="form-control"
            style={{ width: "auto", minWidth: 160 }}
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s ? s.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase()) : "All Statuses"}</option>
            ))}
          </select>

          <button className="btn btn-outline" onClick={fetchApps} title="Refresh">
            <i className="bi bi-arrow-clockwise" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Applicant</th>
              <th>Email</th>
              <th>Document Type</th>
              <th>Face Match</th>
              <th>Status</th>
              <th>Submitted</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8}>
                  <div className="loading-center"><span className="spinner" /></div>
                </td>
              </tr>
            ) : apps.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">
                    <i className="bi bi-file-earmark-x" />
                    <p>No applications found</p>
                  </div>
                </td>
              </tr>
            ) : (
              apps.map((app, i) => (
                <tr key={app.id}>
                  <td style={{ color: "var(--text-muted)", fontSize: 12 }}>
                    {(page - 1) * PAGE_SIZE + i + 1}
                  </td>
                  <td className="td-name">{app.user_name}</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{app.user_email}</td>
                  <td>
                    {app.document_type ? (
                      <span style={{ textTransform: "capitalize" }}>
                        {app.document_type.replace("_", " ")}
                      </span>
                    ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                  </td>
                  <td>
                    <ScorePill score={app.face_match_score} passed={app.face_match_passed} />
                  </td>
                  <td><StatusBadge status={app.status} /></td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {app.submitted_at
                      ? new Date(app.submitted_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })
                      : "—"}
                  </td>
                  <td>
                    <Link to={`/applications/${app.id}`} className="btn btn-sm btn-outline">
                      <i className="bi bi-eye" /> Review
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 20 }}>
          <button
            className="btn btn-outline btn-sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <i className="bi bi-chevron-left" />
          </button>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Page {page} of {totalPages}
          </span>
          <button
            className="btn btn-outline btn-sm"
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <i className="bi bi-chevron-right" />
          </button>
        </div>
      )}
    </>
  );
}