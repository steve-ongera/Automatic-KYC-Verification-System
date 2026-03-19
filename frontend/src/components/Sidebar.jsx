import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../App.jsx";

const navSections = [
  {
    label: "Main",
    items: [
      { to: "/dashboard", icon: "bi-grid-1x2", label: "Dashboard" },
      { to: "/kyc-form", icon: "bi-person-vcard", label: "My KYC", roles: ["customer"] },
      { to: "/profile", icon: "bi-person-circle", label: "Profile" },
    ],
  },
  {
    label: "Management",
    roles: ["admin", "compliance_officer"],
    items: [
      { to: "/applications", icon: "bi-file-earmark-person", label: "Applications" },
      { to: "/alerts", icon: "bi-exclamation-triangle", label: "Alerts", alertBadge: true },
      { to: "/logs", icon: "bi-journal-text", label: "Audit Logs" },
    ],
  },
  {
    label: "Admin",
    roles: ["admin"],
    items: [
      { to: "/users", icon: "bi-people", label: "Users" },
    ],
  },
];

export default function Sidebar({ collapsed, mobileOpen, onCloseMobile }) {
  const location = useLocation();
  const { user, logout } = useAuth();

  const initials = user?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";

  const roleLabel = {
    admin: "Administrator",
    compliance_officer: "Compliance Officer",
    customer: "Customer",
  }[user?.role] || user?.role;

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${mobileOpen ? "active" : ""}`}
        onClick={onCloseMobile}
      />

      <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="logo-icon">
            <i className="bi bi-shield-check" />
          </div>
          <span className="logo-text">VerifyID</span>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {navSections.map((section) => {
            // Section visibility by role
            if (section.roles && !section.roles.includes(user?.role)) return null;
            return (
              <div key={section.label} className="nav-section">
                <div className="nav-section-label">{section.label}</div>
                {section.items.map((item) => {
                  if (item.roles && !item.roles.includes(user?.role)) return null;
                  const isActive = location.pathname === item.to ||
                    (item.to !== "/" && location.pathname.startsWith(item.to));
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`nav-item ${isActive ? "active" : ""}`}
                      onClick={onCloseMobile}
                    >
                      <i className={`bi ${item.icon} nav-icon`} />
                      <span className="nav-label">{item.label}</span>
                      {item.alertBadge && <span className="badge">!</span>}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar">{initials}</div>
            <div className="user-info">
              <div className="user-name">{user?.full_name}</div>
              <div className="user-role">{roleLabel}</div>
            </div>
          </div>
          <button
            className="nav-item"
            style={{ width: "100%", marginTop: 4, background: "none", border: "none" }}
            onClick={logout}
          >
            <i className="bi bi-box-arrow-left nav-icon" />
            <span className="nav-label">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}