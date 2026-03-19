import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect, createContext, useContext } from "react";
import Layout from "./components/Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Applications from "./pages/Applications.jsx";
import ApplicationDetail from "./pages/ApplicationDetail.jsx";
import KYCForm from "./pages/KYCForm.jsx";
import Alerts from "./pages/Alerts.jsx";
import Users from "./pages/Users.jsx";
import Logs from "./pages/Logs.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Profile from "./pages/Profile.jsx";
import { getStoredUser, removeTokens } from "./services/api.js";

// ─── Auth Context ──────────────────────────────────────────────────────────

export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

function PrivateRoute({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

// ─── App ───────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState(() => getStoredUser());
  const [loading, setLoading] = useState(false);

  const login = (userData) => setUser(userData);
  const logout = () => {
    removeTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
          <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register />} />

          {/* Protected */}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="kyc-form" element={<KYCForm />} />
            <Route path="profile" element={<Profile />} />

            {/* Admin / Compliance only */}
            <Route
              path="applications"
              element={
                <PrivateRoute roles={["admin", "compliance_officer"]}>
                  <Applications />
                </PrivateRoute>
              }
            />
            <Route
              path="applications/:id"
              element={
                <PrivateRoute roles={["admin", "compliance_officer"]}>
                  <ApplicationDetail />
                </PrivateRoute>
              }
            />
            <Route
              path="alerts"
              element={
                <PrivateRoute roles={["admin", "compliance_officer"]}>
                  <Alerts />
                </PrivateRoute>
              }
            />
            <Route
              path="users"
              element={
                <PrivateRoute roles={["admin"]}>
                  <Users />
                </PrivateRoute>
              }
            />
            <Route
              path="logs"
              element={
                <PrivateRoute roles={["admin", "compliance_officer"]}>
                  <Logs />
                </PrivateRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}