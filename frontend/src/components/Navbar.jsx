import { useLocation, Link } from "react-router-dom";
import { useAuth } from "../App.jsx";

const pageTitles = {
  "/dashboard": { title: "Dashboard", icon: "bi-grid-1x2" },
  "/kyc-form": { title: "My KYC Application", icon: "bi-person-vcard" },
  "/applications": { title: "KYC Applications", icon: "bi-file-earmark-person" },
  "/alerts": { title: "System Alerts", icon: "bi-exclamation-triangle" },
  "/logs": { title: "Audit Logs", icon: "bi-journal-text" },
  "/users": { title: "User Management", icon: "bi-people" },
  "/profile": { title: "My Profile", icon: "bi-person-circle" },
};

export default function Navbar({ collapsed, onToggle, onMobileToggle }) {
  const location = useLocation();
  const { user } = useAuth();

  // Match current path (handles /applications/:id too)
  const matchedKey = Object.keys(pageTitles).find(
    (k) => location.pathname === k || location.pathname.startsWith(k + "/")
  );
  const page = pageTitles[matchedKey] || { title: "VerifyID", icon: "bi-shield-check" };

  return (
    <header className={`topbar ${collapsed ? "collapsed" : ""}`}>
      <div className="topbar-left">
        {/* Desktop collapse toggle */}
        <button className="toggle-btn d-none d-lg-flex" onClick={onToggle} title="Toggle sidebar">
          <i className="bi bi-layout-sidebar" />
        </button>

        {/* Mobile hamburger */}
        <button className="toggle-btn d-flex d-lg-none" onClick={onMobileToggle} title="Open menu">
          <i className="bi bi-list" />
        </button>

        <div>
          <div className="page-title">
            <i className={`bi ${page.icon}`} style={{ marginRight: 8, color: "var(--primary)" }} />
            {page.title}
          </div>
          <div className="breadcrumb">
            <Link to="/dashboard" style={{ color: "var(--text-muted)" }}>Home</Link>
            {matchedKey && matchedKey !== "/dashboard" && (
              <>
                <i className="bi bi-chevron-right" style={{ fontSize: 10 }} />
                <span>{page.title}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="topbar-right">
        <button className="topbar-action-btn" title="Notifications">
          <i className="bi bi-bell" />
          <span className="dot" />
        </button>

        <button className="topbar-action-btn" title="Help">
          <i className="bi bi-question-circle" />
        </button>

        <Link to="/profile" className="topbar-action-btn" title={user?.full_name}>
          <i className="bi bi-person-circle" />
        </Link>
      </div>
    </header>
  );
}