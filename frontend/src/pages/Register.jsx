import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../App.jsx";
import { authAPI, storeTokens, storeUser } from "../services/api.js";

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", password: "", password_confirm: "" });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      const { data } = await authAPI.register(form);
      storeTokens(data.tokens.access, data.tokens.refresh);
      storeUser(data.user);
      login(data.user);
      navigate("/dashboard");
    } catch (err) {
      if (err.response?.data) {
        setErrors(err.response.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const fieldError = (field) =>
    errors[field] ? (
      <div className="form-error">
        <i className="bi bi-exclamation-circle" /> {Array.isArray(errors[field]) ? errors[field][0] : errors[field]}
      </div>
    ) : null;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <i className="bi bi-shield-check" />
          </div>
          <span className="auth-logo-text">VerifyID</span>
        </div>

        <h1 className="auth-heading">Create account</h1>
        <p className="auth-sub">Start your KYC verification process</p>

        {errors.non_field_errors && (
          <div className="alert-banner error">
            <i className="bi bi-exclamation-circle" />
            {errors.non_field_errors[0]}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <div className="input-group">
              <i className="bi bi-person input-icon" />
              <input
                type="text"
                name="full_name"
                className={`form-control ${errors.full_name ? "error" : ""}`}
                placeholder="John Doe"
                value={form.full_name}
                onChange={handleChange}
                required
              />
            </div>
            {fieldError("full_name")}
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div className="input-group">
              <i className="bi bi-envelope input-icon" />
              <input
                type="email"
                name="email"
                className={`form-control ${errors.email ? "error" : ""}`}
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>
            {fieldError("email")}
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-group">
              <i className="bi bi-lock input-icon" />
              <input
                type="password"
                name="password"
                className={`form-control ${errors.password ? "error" : ""}`}
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={handleChange}
                required
              />
            </div>
            {fieldError("password")}
          </div>

          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <div className="input-group">
              <i className="bi bi-lock-fill input-icon" />
              <input
                type="password"
                name="password_confirm"
                className={`form-control ${errors.password_confirm ? "error" : ""}`}
                placeholder="Repeat password"
                value={form.password_confirm}
                onChange={handleChange}
                required
              />
            </div>
            {fieldError("password_confirm")}
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading}
            style={{ marginTop: 4 }}
          >
            {loading ? <span className="spinner" /> : <i className="bi bi-person-plus" />}
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <hr className="divider" />
        <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "var(--primary)", fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}