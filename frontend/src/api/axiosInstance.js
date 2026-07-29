import axios from 'axios';
import { auth } from '../config/firebase';

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || '').trim() || 'http://localhost:5000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000,
});

// ── Request interceptor — attach Firebase ID Token ────────
// Firebase tokens expire every 1 hour. getIdToken(true) auto-refreshes if needed.
api.interceptors.request.use(
  async (config) => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const idToken = await currentUser.getIdToken();
      config.headers.Authorization = `Bearer ${idToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor — unwrap envelope & handle 401 ─
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // On 401, redirect to login
    if (error.response?.status === 401) {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'Something went wrong';
    return Promise.reject(new Error(message));
  }
);

export default api;
