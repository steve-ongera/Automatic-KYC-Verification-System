import { useEffect, useState } from "react";
import { usersAPI } from "../services/api.js";

const ROLE_BADGE = {
  admin: { cls: "status-rejected", label: "Admin" },
  compliance_officer: { cls: "status-under_review", label: "Compliance" },
  customer: { cls: "status-approved", label: "Customer" },
};

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    usersAPI.list()
      .then(({ data }) => setUsers(data.results || data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>User Management</h1>
          <p>{users.length} registered users</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <div className="input-group" style={{ maxWidth: 400 }}>
            <i className="bi bi-search input-icon" />
            <input
              type="text"
              className="form-control"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5}><div className="loading-center"><span className="spinner" /></div></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5}><div className="empty-state"><i className="bi bi-people" /><p>No users found</p></div></td></tr>
            ) : filtered.map((user, i) => {
              const role = ROLE_BADGE[user.role] || { cls: "", label: user.role };
              const initials = user.full_name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
              return (
                <tr key={user.id}>
                  <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{i + 1}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: "var(--primary-light)", color: "var(--primary)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700, flexShrink: 0,
                      }}>{initials}</div>
                      <span className="td-name">{user.full_name}</span>
                    </div>
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{user.email}</td>
                  <td><span className={`status-badge ${role.cls}`}>{role.label}</span></td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {new Date(user.date_joined).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
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