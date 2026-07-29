import api from './axiosInstance';

// GET /api/v1/dashboard/stats — Main dashboard KPIs
export const getDashboardStats = async () => {
  const res = await api.get('/dashboard/stats');
  return res.data;
};
