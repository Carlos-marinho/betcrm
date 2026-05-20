import axios from "axios";
import { clearToken, getRefreshToken, getToken, setToken } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
let refreshPromise: Promise<string> | null = null;

export const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const refresh = getRefreshToken();

      if (refresh) {
        try {
          refreshPromise ??= axios
            .post(`${API_BASE}/api/token/refresh/`, { refresh })
            .then((response) => response.data.access as string)
            .finally(() => {
              refreshPromise = null;
            });

          const access = await refreshPromise;
          setToken(access);
          originalRequest.headers.Authorization = `Bearer ${access}`;
          return api(originalRequest);
        } catch {
          clearToken();
          if (typeof window !== "undefined") window.location.href = "/login";
        }
      } else {
        clearToken();
        if (typeof window !== "undefined") window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);
