import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import Navbar from "./Navbar.jsx";

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className={`main-content ${collapsed ? "collapsed" : ""}`}>
        <Navbar
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
          onMobileToggle={() => setMobileOpen((o) => !o)}
        />
        <main className="page-body">
          <Outlet />
        </main>
      </div>
    </div>
  );
}