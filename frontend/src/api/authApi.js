import api from './axiosInstance';

// Register a new user
export const registerUser = (name, email, password) =>
  api.post('/auth/register', { name, email, password });

// Login with email and password
export const loginUser = (email, password) =>
  api.post('/auth/login', { email, password });

// Logout (server acknowledges; client drops token)
export const logoutUser = () =>
  api.post('/auth/logout');

// Get the currently authenticated user
export const getMe = () =>
  api.get('/auth/me');

// Request a password reset email
export const forgotPassword = (email) =>
  api.post('/auth/forgot-password', { email });

// Reset password using the token from the email link
export const resetPassword = (token, password) =>
  api.post(`/auth/reset-password/${token}`, { password });
