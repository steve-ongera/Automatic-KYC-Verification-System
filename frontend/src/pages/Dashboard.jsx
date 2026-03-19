import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../App.jsx";
import { dashboardAPI, kycAPI } from "../services/api.js";

function StatCard({ label, value, icon, variant = "", sub }) {
  return (
    <div className={`stat-card ${variant}`}>
      <div className="stat-icon">
        <i className={`bi ${icon}`} />
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value ?? "—"}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function ScoreBar({ score }) {
  const pct = Math.round((score || 0) * 100);
  const cls = pct >= 80 ? "high" : pct >= 60 ? "mid" : "low";
  return (
    <div className="score-bar-wrap">
      <div className="score-bar">
        <div className="score-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span style={{ fontSize: 12, color: "var(--text-secondary)", minWidth: 36 }}>{pct}%</span>
    </div>
  );
}

// Admin / Compliance Dashboard
function AdminDashboard({ stats }) {
  return (
    <>
      <div className="stat-grid">
        <StatCard label="Total Applications" value={stats.total_applications} icon="bi-file-earmark-person" sub="All time" />
        <StatCard label="Pending Review" value={stats.pending} icon="bi-hourglass-split" variant="warning" sub="Awaiting action" />
        <StatCard label="Approved" value={stats.approved} icon="bi-patch-check" variant="success" sub={`${stats.approval_rate}% approval rate`} />
        <StatCard label="Rejected" value={stats.rejected} icon="bi-x-circle" variant="danger" />
        <StatCard label="Under Review" value={stats.under_review} icon="bi-search" variant="info" />
        <StatCard label="Total Users" value={stats.total_users} icon="bi-people" />
        <StatCard label="Unresolved Alerts" value={stats.unresolved_alerts} icon="bi-exclamation-triangle" variant="danger" />
        <StatCard
          label="Avg Face Match"
          value={stats.avg_face_match_score ? `${Math.round(stats.avg_face_match_score * 100)}%` : "—"}
          icon="bi-person-bounding-box"
          variant="info"
        />
      </div>

      {/* Quick actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <i className="bi bi-lightning-charge" style={{ color: "var(--primary)", marginRight: 6 }} />
              Quick Actions
            </span>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Link to="/applications?status=pending" className="btn btn-outline btn-full">
              <i className="bi bi-hourglass-split" /> View Pending Applications
            </Link>
            <Link to="/alerts?unresolved=true" className="btn btn-outline btn-full">
              <i className="bi bi-exclamation-triangle" /> View Unresolved Alerts
            </Link>
            <Link to="/applications" className="btn btn-primary btn-full">
              <i className="bi bi-grid" /> All Applications
            </Link>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <i className="bi bi-bar-chart" style={{ color: "var(--primary)", marginRight: 6 }} />
              Status Overview
            </span>
          </div>
          <div className="card-body">
            {[
              { label: "Approved", count: stats.approved, total: stats.total_applications, cls: "success" },
              { label: "Pending", count: stats.pending, total: stats.total_applications, cls: "warning" },
              { label: "Rejected", count: stats.rejected, total: stats.total_applications, cls: "danger" },
              { label: "Under Review", count: stats.under_review, total: stats.total_applications, cls: "info" },
            ].map(({ label, count, total, cls }) => {
              const pct = total ? Math.round((count / total) * 100) : 0;
              return (
                <div key={label} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4, color: "var(--text-secondary)" }}>
                    <span>{label}</span>
                    <span style={{ fontWeight: 600 }}>{count} ({pct}%)</span>
                  </div>
                  <div className="score-bar">
                    <div
                      className={`score-bar-fill ${cls === "success" ? "high" : cls === "danger" ? "low" : "mid"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

// Customer Dashboard
function CustomerDashboard({ kycStatus }) {
  const steps = ["pending", "under_review", "approved"];
  const currentStep = steps.indexOf(kycStatus?.status) + 1 || 0;

  const statusMeta = {
    null: { icon: "bi-info-circle", color: "var(--info)", msg: "You haven't started your KYC application yet." },
    pending: { icon: "bi-hourglass", color: "var(--warning)", msg: "Your application is saved but not yet submitted." },
    under_review: { icon: "bi-search", color: "var(--info)", msg: "Your application is being reviewed by our compliance team." },
    approved: { icon: "bi-patch-check-fill", color: "var(--success)", msg: "Your identity has been verified successfully!" },
    rejected: { icon: "bi-x-circle-fill", color: "var(--danger)", msg: "Your application was rejected. Please check the rejection reason and resubmit." },
    resubmit: { icon: "bi-arrow-repeat", color: "#7c3aed", msg: "Please update your application with the required information." },
  };

  const meta = statusMeta[kycStatus?.status] || statusMeta[null];

  return (
    <>
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body" style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{
            width: 60, height: 60, borderRadius: "50%",
            background: `${meta.color}22`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, color: meta.color, flexShrink: 0,
          }}>
            <i className={`bi ${meta.icon}`} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
              KYC Status:{" "}
              <span className={`status-badge status-${kycStatus?.status || "pending"}`}>
                {kycStatus?.status ? kycStatus.status.replace("_", " ").toUpperCase() : "NOT STARTED"}
              </span>
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>{meta.msg}</p>
          </div>
          {(!kycStatus?.status || kycStatus?.status === "pending" || kycStatus?.status === "resubmit") && (
            <Link to="/kyc-form" className="btn btn-primary">
              <i className="bi bi-arrow-right-circle" />
              {kycStatus?.status ? "Continue Application" : "Start KYC"}
            </Link>
          )}
        </div>
      </div>

      {/* Progress stepper */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title"><i className="bi bi-list-check" style={{ color: "var(--primary)", marginRight: 6 }} /> Verification Steps</span>
        </div>
        <div className="card-body">
          <div className="stepper">
            {[
              { label: "Personal Info", icon: "bi-person" },
              { label: "Documents", icon: "bi-card-image" },
              { label: "Face Match", icon: "bi-person-bounding-box" },
              { label: "Review", icon: "bi-search" },
              { label: "Verified", icon: "bi-patch-check" },
            ].map((step, i) => {
              const done = i < currentStep;
              const active = i === currentStep;
              return (
                <div key={step.label} className={`step ${done ? "completed" : ""} ${active ? "active" : ""}`}>
                  <div className="step-number">
                    {done ? <i className="bi bi-check" /> : i + 1}
                  </div>
                  <span className="step-label">{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title"><i className="bi bi-info-circle" style={{ color: "var(--primary)", marginRight: 6 }} /> What to Prepare</span>
        </div>
        <div className="card-body">
          {[
            { icon: "bi-card-image", text: "A valid government-issued ID (National ID, Passport, or Driver's License)" },
            { icon: "bi-camera", text: "A clear selfie photo taken in good lighting" },
            { icon: "bi-calendar-check", text: "Ensure your document is not expired" },
            { icon: "bi-shield-lock", text: "Your data is encrypted and stored securely" },
          ].map(({ icon, text }) => (
            <div key={text} style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
              <i className={`bi ${icon}`} style={{ color: "var(--primary)", fontSize: 16, marginTop: 1, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = ["admin", "compliance_officer"].includes(user?.role);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardAPI.getStats()
      .then(({ data }) => setStats(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>
            {isAdmin ? "Dashboard Overview" : `Welcome, ${user?.full_name?.split(" ")[0]} 👋`}
          </h1>
          <p>{isAdmin ? "Monitor all KYC verification activities" : "Manage your identity verification"}</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-center"><span className="spinner spinner-lg" /></div>
      ) : isAdmin ? (
        <AdminDashboard stats={stats} />
      ) : (
        <CustomerDashboard kycStatus={stats} />
      )}
    </>
  );
}