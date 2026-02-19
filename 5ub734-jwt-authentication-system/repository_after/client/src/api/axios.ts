import axios from "axios";

const getBaseUrl = () => {
  // Allow test/Node override
  const nodeUrl = (globalThis as any)?.process?.env?.VITE_API_URL;
  if (nodeUrl) return nodeUrl;

  // Allow runtime override (optional)
  const runtimeUrl = (globalThis as any)?.VITE_API_URL;
  if (runtimeUrl) return runtimeUrl;

  return "http://localhost:4000/api";
};

const api = axios.create({
  baseURL: getBaseUrl(),
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers["Authorization"] = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await api.post("/auth/refresh");
        const { accessToken } = data;

        api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;
        originalRequest.headers["Authorization"] = `Bearer ${accessToken}`;

        processQueue(null, accessToken);
        window.dispatchEvent(
          new CustomEvent("tokenRefreshed", { detail: accessToken })
        );

        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        window.dispatchEvent(new Event("authLogout"));
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
