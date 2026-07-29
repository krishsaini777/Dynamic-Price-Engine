import { useState, useEffect, useCallback, useRef } from 'react';
import { getEvents, createEvent, updateEvent, deleteEvent, activateEvent, deactivateEvent } from '../api/eventApi';

export default function useEvents(initialParams = {}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const lastParams = useRef(initialParams);

  const fetchEvents = useCallback(async (params) => {
    // If no params provided, re-use last params to preserve tab filter
    const effectiveParams = params !== undefined ? params : lastParams.current;
    lastParams.current = effectiveParams;
    try {
      setLoading(true);
      setError(null);
      const res = await getEvents(effectiveParams);
      setEvents(res.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const addEvent = async (data) => {
    const res = await createEvent(data);
    await fetchEvents();
    return res;
  };

  const editEvent = async (id, updates) => {
    const res = await updateEvent(id, updates);
    await fetchEvents();
    return res;
  };

  const removeEvent = async (id) => {
    const res = await deleteEvent(id);
    await fetchEvents();
    return res;
  };

  const activate = async (id) => {
    const res = await activateEvent(id);
    await fetchEvents();
    return res;
  };

  const deactivate = async (id) => {
    const res = await deactivateEvent(id);
    await fetchEvents();
    return res;
  };

  return {
    events,
    loading,
    error,
    setError,
    fetchEvents,
    addEvent,
    editEvent,
    removeEvent,
    activate,
    deactivate,
  };
}
