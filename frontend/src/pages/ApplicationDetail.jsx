import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { kycAPI } from "../services/api.js";

function StatusBadge({ status }) {
  const labels = { pending: "Pending", under_review: "Under Review", approved: "Approved", rejected: "Rejected", resubmit: "Resubmit" };
  return <span className={`status-badge status-${status}`}>{labels[status] || status}</span>;
}

function InfoRow({ label, value, mono }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-light)" }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, fontFamily: mono ? "var(--font-mono)" : undefined }}>
        {value || <span style={{ color: "var(--text-muted)" }}>—</span>}
      </span>
    </div>
  );
}

export default function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [reviewForm, setReviewForm] = useState({ status: "", review_notes: "", rejection_reason: "" });
  const [reviewMsg, setReviewMsg] = useState(null);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    kycAPI.get(id).then(({ data }) => setApp(data)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const runAction = async (action, label) => {
    setActionLoading(label);
    setError("");
    try {
      if (action === "ocr") await kycAPI.runOCR(id);
      if (action === "face") await kycAPI.runFaceMatch(id);
      if (action === "submit") await kycAPI.submitApplication(id);
      load();
    } catch (e) {
      setError(e.response?.data?.error || `${label} failed.`);
    } finally {
      setActionLoading("");
    }
  };

  const submitReview = async () => {
    if (!reviewForm.status) return setError("Please select a review status.");
    setActionLoading("review");
    setError("");
    try {
      await kycAPI.review(id, reviewForm);
      setReviewMsg("Review submitted successfully.");
      load();
    } catch (e) {
      setError(e.response?.data?.rejection_reason?.[0] || "Review failed.");
    } finally {
      setActionLoading("");
    }
  };

  if (loading) return <div className="loading-center"><span className="spinner spinner-lg" /></div>;
  if (!app) return <div className="empty-state"><i className="bi bi-file-earmark-x" /><p>Application not found.</p></div>;

  const faceScore = app.face_match_score != null ? Math.round(app.face_match_score * 100) : null;

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>{app.user?.full_name}'s KYC Application</h1>
          <p>Application ID: <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{app.id}</span></p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <StatusBadge status={app.status} />
          <button className="btn btn-outline btn-sm" onClick={() => navigate(-1)}>
            <i className="bi bi-arrow-left" /> Back
          </button>
        </div>
      </div>

      {error && <div className="alert-banner error"><i className="bi bi-exclamation-circle" />{error}</div>}
      {reviewMsg && <div className="alert-banner success"><i className="bi bi-check-circle" />{reviewMsg}</div>}

      {/* Automated Actions */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title"><i className="bi bi-cpu" style={{ color: "var(--primary)", marginRight: 6 }} />Automated Checks</span>
        </div>
        <div className="card-body" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn-outline" onClick={() => runAction("ocr", "OCR")} disabled={!!actionLoading}>
            {actionLoading === "OCR" ? <span className="spinner" /> : <i className="bi bi-file-earmark-text" />}
            Run OCR
          </button>
          <button className="btn btn-outline" onClick={() => runAction("face", "Face Match")} disabled={!!actionLoading}>
            {actionLoading === "Face Match" ? <span className="spinner" /> : <i className="bi bi-person-bounding-box" />}
            Run Face Match
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

        {/* Personal Info */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><i className="bi bi-person" style={{ color: "var(--primary)", marginRight: 6 }} />Personal Information</span>
          </div>
          <div className="card-body">
            <InfoRow label="Full Name" value={app.user?.full_name} />
            <InfoRow label="Email" value={app.user?.email} mono />
            <InfoRow label="Phone" value={app.phone_number} />
            <InfoRow label="Date of Birth" value={app.date_of_birth} />
            <InfoRow label="Nationality" value={app.nationality} />
            <InfoRow label="Address" value={app.address} />
            <InfoRow label="City" value={app.city} />
            <InfoRow label="Country" value={app.country} />
          </div>
        </div>

        {/* Document Info */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><i className="bi bi-card-image" style={{ color: "var(--primary)", marginRight: 6 }} />Document Information</span>
          </div>
          <div className="card-body">
            <InfoRow label="Document Type" value={app.document_type_display} />
            <InfoRow label="Document Number" value={app.document_number} mono />
            <InfoRow label="Expiry Date" value={app.document_expiry} />
            <InfoRow label="OCR Name" value={app.ocr_extracted_name} />
            <InfoRow label="OCR Date of Birth" value={app.ocr_extracted_dob} />
            <InfoRow label="OCR Doc Number" value={app.ocr_extracted_doc_number} mono />
          </div>
        </div>

        {/* Face Match Result */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><i className="bi bi-person-bounding-box" style={{ color: "var(--primary)", marginRight: 6 }} />Face Match Result</span>
          </div>
          <div className="card-body">
            {faceScore != null ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <span style={{ fontSize: 40, fontWeight: 700, color: app.face_match_passed ? "var(--success)" : "var(--danger)" }}>
                    {faceScore}%
                  </span>
                  <span className={`status-badge ${app.face_match_passed ? "status-approved" : "status-rejected"}`}>
                    <i className={`bi ${app.face_match_passed ? "bi-check-circle" : "bi-x-circle"}`} />
                    {app.face_match_passed ? "PASSED" : "FAILED"}
                  </span>
                </div>
                <div className="score-bar" style={{ height: 10 }}>
                  <div className={`score-bar-fill ${faceScore >= 80 ? "high" : faceScore >= 60 ? "mid" : "low"}`} style={{ width: `${faceScore}%` }} />
                </div>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>Threshold: 75% — Scores above 75% pass verification</p>
              </>
            ) : (
              <div className="empty-state" style={{ padding: "20px 0" }}>
                <i className="bi bi-person-bounding-box" style={{ fontSize: 32 }} />
                <p>No face match results yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Images */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><i className="bi bi-images" style={{ color: "var(--primary)", marginRight: 6 }} />Uploaded Documents</span>
          </div>
          <div className="card-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { label: "ID Front", src: app.id_document_front },
              { label: "ID Back", src: app.id_document_back },
              { label: "Selfie", src: app.selfie_image },
            ].map(({ label, src }) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, fontWeight: 600 }}>{label}</div>
                {src ? (
                  <a href={src} target="_blank" rel="noreferrer">
                    <img src={src} alt={label} style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} />
                  </a>
                ) : (
                  <div style={{ width: "100%", height: 90, background: "var(--bg)", borderRadius: 6, border: "1px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 11 }}>
                    Not uploaded
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Review Panel */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <span className="card-title"><i className="bi bi-clipboard-check" style={{ color: "var(--primary)", marginRight: 6 }} />Manual Review Decision</span>
        </div>
        <div className="card-body">
          {app.reviewed_by_name && (
            <div className="alert-banner info" style={{ marginBottom: 16 }}>
              <i className="bi bi-info-circle" />
              Last reviewed by <strong>{app.reviewed_by_name}</strong> on {new Date(app.reviewed_at).toLocaleString()}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Decision *</label>
              <select className="form-control" value={reviewForm.status} onChange={(e) => setReviewForm({ ...reviewForm, status: e.target.value })}>
                <option value="">Select decision…</option>
                <option value="approved">✅ Approve</option>
                <option value="rejected">❌ Reject</option>
                <option value="resubmit">🔄 Request Resubmission</option>
                <option value="under_review">🔍 Keep Under Review</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Review Notes</label>
              <textarea className="form-control" rows={1} placeholder="Internal notes (not shown to customer)…" value={reviewForm.review_notes} onChange={(e) => setReviewForm({ ...reviewForm, review_notes: e.target.value })} />
            </div>
          </div>
          {reviewForm.status === "rejected" && (
            <div className="form-group">
              <label className="form-label">Rejection Reason (shown to customer) *</label>
              <textarea className="form-control" rows={2} placeholder="Explain why the application was rejected…" value={reviewForm.rejection_reason} onChange={(e) => setReviewForm({ ...reviewForm, rejection_reason: e.target.value })} />
            </div>
          )}
          <button className="btn btn-primary" onClick={submitReview} disabled={!!actionLoading}>
            {actionLoading === "review" ? <span className="spinner" /> : <i className="bi bi-send" />}
            Submit Review
          </button>
        </div>
      </div>

      {/* Audit Logs */}
      {app.logs?.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <span className="card-title"><i className="bi bi-clock-history" style={{ color: "var(--primary)", marginRight: 6 }} />Activity Log</span>
          </div>
          <div style={{ padding: "0 24px 16px" }}>
            {app.logs.map((log) => (
              <div key={log.id} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border-light)" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--primary)", marginTop: 5, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{log.action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    by {log.performed_by_name} · {new Date(log.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}