import api from './axiosInstance';

// GET /api/v1/settings — Get all settings
export const getAllSettings = async () => {
  const res = await api.get('/settings');
  return res.data;
};

// PATCH /api/v1/settings/:key — Update a setting value
export const updateSetting = async (key, value) => {
  const res = await api.patch(`/settings/${key}`, { value });
  return res.data;
};

// GET /api/v1/settings/seasonal — Get seasonal toggle config
export const getSeasonalConfig = async () => {
  const res = await api.get('/settings/seasonal');
  return res.data;
};

// PATCH /api/v1/settings/seasonal/toggle — Toggle seasonal ON/OFF
export const toggleSeasonal = async (enabled) => {
  const res = await api.patch('/settings/seasonal/toggle', { enabled });
  return res.data;
};

// PATCH /api/v1/settings/seasonal/categories — Update disabled categories
export const updateSeasonalCategories = async (categories) => {
  const res = await api.patch('/settings/seasonal/categories', { categories });
  return res.data;
};
