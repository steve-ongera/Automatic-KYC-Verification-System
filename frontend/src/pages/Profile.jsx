import { useEffect, useState } from "react";
import { useAuth } from "../App.jsx";
import { authAPI, storeUser } from "../services/api.js";

export default function Profile() {
  const { user, login } = useAuth();
  const [form, setForm] = useState({ full_name: user?.full_name || "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState("");

  const initials = user?.full_name?.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() || "U";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    setError("");
    try {
      const { data } = await authAPI.updateProfile(form);
      storeUser(data);
      login(data);
      setMsg("Profile updated successfully.");
    } catch (err) {
      setError("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = { admin: "Administrator", compliance_officer: "Compliance Officer", customer: "Customer" }[user?.role] || user?.role;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>My Profile</h1>
          <p>Manage your account information</p>
        </div>
      </div>

      {/* Avatar card */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "var(--primary-light)", color: "var(--primary)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 26, fontWeight: 700,
          }}>
            {initials}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{user?.full_name}</div>
            <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>{user?.email}</div>
            <span className={`status-badge ${user?.role === "admin" ? "status-rejected" : user?.role === "compliance_officer" ? "status-under_review" : "status-approved"}`} style={{ marginTop: 6, display: "inline-flex" }}>
              <i className="bi bi-shield-check" /> {roleLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Edit form */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <i className="bi bi-pencil-square" style={{ color: "var(--primary)", marginRight: 6 }} />
            Edit Profile
          </span>
        </div>
        <div className="card-body">
          {msg && <div className="alert-banner success"><i className="bi bi-check-circle" />{msg}</div>}
          {error && <div className="alert-banner error"><i className="bi bi-exclamation-circle" />{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div className="input-group">
                <i className="bi bi-person input-icon" />
                <input
                  type="text"
                  className="form-control"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-group">
                <i className="bi bi-envelope input-icon" />
                <input type="email" className="form-control" value={user?.email} disabled style={{ background: "var(--bg)", color: "var(--text-muted)" }} />
              </div>
              <div className="form-error" style={{ color: "var(--text-muted)" }}>Email cannot be changed.</div>
            </div>

            <div className="form-group">
              <label className="form-label">Role</label>
              <div className="input-group">
                <i className="bi bi-shield input-icon" />
                <input type="text" className="form-control" value={roleLabel} disabled style={{ background: "var(--bg)", color: "var(--text-muted)", textTransform: "capitalize" }} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Member Since</label>
              <div className="input-group">
                <i className="bi bi-calendar input-icon" />
                <input type="text" className="form-control" value={user?.date_joined ? new Date(user.date_joined).toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" }) : "—"} disabled style={{ background: "var(--bg)", color: "var(--text-muted)" }} />
              </div>
            </div>

            <hr className="divider" />

            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : <i className="bi bi-check-lg" />}
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}