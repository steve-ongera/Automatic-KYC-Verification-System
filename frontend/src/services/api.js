import axios from "axios";

const BASE_URL = "/api/v1";

// ─── Token Storage ────────────────────────────────────────────────────────────

export function getAccessToken() {
  return localStorage.getItem("access_token");
}
export function getRefreshToken() {
  return localStorage.getItem("refresh_token");
}
export function storeTokens(access, refresh) {
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
}
export function removeTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("kyc_user");
}
export function getStoredUser() {
  try {
    const u = localStorage.getItem("kyc_user");
    return u ? JSON.parse(u) : null;
  } catch {
    return null;
  }
}
export function storeUser(user) {
  localStorage.setItem("kyc_user", JSON.stringify(user));
}

// ─── Axios Instance ───────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = getRefreshToken();
        const { data } = await axios.post(`${BASE_URL}/auth/token/refresh/`, { refresh });
        storeTokens(data.access, data.refresh || refresh);
        original.headers.Authorization = `Bearer ${data.access}`;
        return api(original);
      } catch {
        removeTokens();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth API ─────────────────────────────────────────────────────────────────

export const authAPI = {
  register: (data) => api.post("/auth/register/", data),
  login: (data) => api.post("/auth/login/", data),
  logout: (refresh) => api.post("/auth/logout/", { refresh }),
  profile: () => api.get("/auth/profile/"),
  updateProfile: (data) => api.patch("/auth/profile/", data),
};

// ─── Dashboard API ────────────────────────────────────────────────────────────

export const dashboardAPI = {
  getStats: () => api.get("/dashboard/stats/"),
};

// ─── KYC Applications API ─────────────────────────────────────────────────────

export const kycAPI = {
  list: (params) => api.get("/kyc-applications/", { params }),
  get: (id) => api.get(`/kyc-applications/${id}/`),
  create: (data) => api.post("/kyc-applications/", data),
  update: (id, data) => api.patch(`/kyc-applications/${id}/`, data),

  uploadDocuments: (id, files) => {
    const form = new FormData();
    Object.entries(files).forEach(([key, file]) => {
      if (file) form.append(key, file);
    });
    return api.post(`/kyc-applications/${id}/upload-documents/`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  submitApplication: (id) => api.post(`/kyc-applications/${id}/submit/`),
  runOCR: (id) => api.post(`/kyc-applications/${id}/run-ocr/`),
  runFaceMatch: (id) => api.post(`/kyc-applications/${id}/run-face-match/`),
  review: (id, data) => api.post(`/kyc-applications/${id}/review/`, data),
};

// ─── Alerts API ───────────────────────────────────────────────────────────────

export const alertsAPI = {
  list: (params) => api.get("/alerts/", { params }),
  resolve: (id) => api.post(`/alerts/${id}/resolve/`),
};

// ─── Users API ────────────────────────────────────────────────────────────────

export const usersAPI = {
  list: () => api.get("/users/"),
  get: (id) => api.get(`/users/${id}/`),
};

// ─── Logs API ─────────────────────────────────────────────────────────────────

export const logsAPI = {
  list: (params) => api.get("/logs/", { params }),
};

export default api;