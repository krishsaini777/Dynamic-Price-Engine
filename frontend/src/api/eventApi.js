import api from './axiosInstance';

// GET /api/v1/events — List all events (optionally filter by status)
export const getEvents = async (params = {}) => {
  const res = await api.get('/events', { params });
  return res.data;
};

// GET /api/v1/events/:id — Single event with analytics summary
export const getEvent = async (id) => {
  const res = await api.get(`/events/${id}`);
  return res.data;
};

// POST /api/v1/events — Create event (starts in DRAFT)
export const createEvent = async (data) => {
  const res = await api.post('/events', data);
  return res.data;
};

// PATCH /api/v1/events/:id — Update event (only DRAFT/SCHEDULED)
export const updateEvent = async (id, updates) => {
  const res = await api.patch(`/events/${id}`, updates);
  return res.data;
};

// DELETE /api/v1/events/:id — Delete event (only DRAFT/INACTIVE)
export const deleteEvent = async (id) => {
  const res = await api.delete(`/events/${id}`);
  return res.data;
};

// PATCH /api/v1/events/:id/activate — Transition to SCHEDULED/ACTIVE
export const activateEvent = async (id) => {
  const res = await api.patch(`/events/${id}/activate`);
  return res.data;
};

// PATCH /api/v1/events/:id/deactivate — Transition to INACTIVE
export const deactivateEvent = async (id) => {
  const res = await api.patch(`/events/${id}/deactivate`);
  return res.data;
};

// GET /api/v1/events/active — List currently active events
export const getActiveEvents = async () => {
  const res = await api.get('/events/active');
  return res.data;
};

// GET /api/v1/events/upcoming — List scheduled future events
export const getUpcomingEvents = async () => {
  const res = await api.get('/events/upcoming');
  return res.data;
};

// GET /api/v1/events/:id/analytics — Event performance analytics
export const getEventAnalytics = async (id) => {
  const res = await api.get(`/events/${id}/analytics`);
  return res.data;
};
