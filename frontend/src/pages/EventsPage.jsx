import React, { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { getEvents, getActiveEvents, getUpcomingEvents, createEvent, updateEvent, deleteEvent, activateEvent, deactivateEvent } from '../api/eventApi';
import useEvents from '../hooks/useEvents';
import EventTable from '../components/events/EventTable';
import EventForm from '../components/events/EventForm';
import EventCalendar from '../components/events/EventCalendar';
import EventPerformanceCard from '../components/analytics/EventPerformanceCard';
import ErrorAlert from '../components/common/ErrorAlert';
import Modal from '../components/common/Modal';

const TABS = [
  { key: 'active', label: 'Active' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
];

export default function EventsPage() {
  const [activeTab, setActiveTab] = useState('active');
  const { events, loading, error, setError, fetchEvents, addEvent, editEvent: editEventHook, removeEvent, activate, deactivate } = useEvents();
  const [allEvents, setAllEvents] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [expandedPastId, setExpandedPastId] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Fetch tab data when tab changes
  useEffect(() => {
    if (activeTab === 'active') {
      fetchEvents({ status: 'ACTIVE' });
    } else if (activeTab === 'upcoming') {
      fetchEvents({ status: 'SCHEDULED,DRAFT' });
    } else if (activeTab === 'past') {
      fetchEvents({ status: 'EXPIRED,INACTIVE' });
    }
    setExpandedPastId(null);
  }, [activeTab, fetchEvents]);

  // Fetch all events for calendar
  const fetchAllEvents = useCallback(async () => {
    try {
      const res = await getEvents();
      setAllEvents(res.data || []);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchAllEvents();
  }, [fetchAllEvents]);

  const handleCreate = () => {
    setEditingEvent(null);
    setFormOpen(true);
  };

  const handleEdit = (event) => {
    setEditingEvent(event);
    setFormOpen(true);
  };

  const handleFormSubmit = async (data) => {
    try {
      setActionError(null);
      if (editingEvent) {
        await editEventHook(editingEvent._id, data);
      } else {
        await addEvent(data);
      }
      setFormOpen(false);
      fetchAllEvents();
    } catch (err) {
      setActionError(err.message);
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setActionError(null);
      await removeEvent(deleteTarget._id);
      setDeleteTarget(null);
      fetchAllEvents();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleActivate = async (id) => {
    try {
      setActionError(null);
      await activate(id);
      fetchAllEvents();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleDeactivate = async (id) => {
    try {
      setActionError(null);
      await deactivate(id);
      fetchAllEvents();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const togglePastExpand = (eventId) => {
    setExpandedPastId(expandedPastId === eventId ? null : eventId);
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Events</h1>
          <p className="page-subtitle">Promotional events lifecycle and performance</p>
        </div>
        <button className="btn btn-primary" onClick={handleCreate}>
          <Plus size={16} /> Create Event
        </button>
      </div>

      {(error || actionError) && (
        <ErrorAlert message={error || actionError} onDismiss={() => { setError(null); setActionError(null); }}>
          {error && (
            <button className="btn btn-secondary btn-sm" onClick={() => fetchEvents()} style={{ marginTop: '0.5rem' }}>
              Retry
            </button>
          )}
        </ErrorAlert>
      )}

      {/* ─── Tab Bar ─── */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.25rem', background: 'var(--bg-secondary)', borderRadius: 10, padding: '0.25rem' }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, padding: '0.6rem 1rem', borderRadius: 8,
              border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
              background: activeTab === tab.key ? 'var(--accent-indigo)' : 'transparent',
              color: activeTab === tab.key ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            {tab.label}
            {!loading && (
              <span style={{
                marginLeft: '0.5rem', fontSize: '0.7rem', fontWeight: 700,
                background: activeTab === tab.key ? 'rgba(255,255,255,0.2)' : 'var(--bg-hover)',
                padding: '0.1rem 0.4rem', borderRadius: 6,
              }}>
                {events.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── Loading ─── */}
      {loading && (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-indigo)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Loading events...</p>
        </div>
      )}

      {/* ─── Active & Upcoming tabs — standard EventTable ─── */}
      {!loading && activeTab !== 'past' && (
        <EventTable
          events={events}
          onEdit={handleEdit}
          onDelete={setDeleteTarget}
          onActivate={handleActivate}
          onDeactivate={handleDeactivate}
        />
      )}

      {/* ─── Past tab — EventTable with expandable performance rows ─── */}
      {!loading && activeTab === 'past' && (
        <>
          {events.length === 0 ? (
            <div className="empty-state"><p>No expired events found.</p></div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Event Name</th>
                    <th>Type</th>
                    <th>Discount</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Performance</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <React.Fragment key={event._id}>
                      <tr>
                        <td style={{ fontWeight: 500 }}>{event.eventName}</td>
                        <td><span className="badge badge-gray">{event.eventType?.replace(/_/g, ' ')}</span></td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                          {event.discountType === 'percentage' && `${event.discountValue}%`}
                          {event.discountType === 'flat_amount' && `₹${event.discountValue}`}
                          {event.discountType === 'fixed_price' && `→ ₹${event.discountValue}`}
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {new Date(event.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {new Date(event.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td><span className="badge badge-red">EXPIRED</span></td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => togglePastExpand(event._id)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                          >
                            {expandedPastId === event._id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            Performance
                          </button>
                        </td>
                      </tr>
                      {/* Expandable performance row */}
                      {expandedPastId === event._id && (
                        <tr>
                          <td colSpan={7} style={{ padding: '1rem', background: 'var(--bg-secondary)' }}>
                            <EventPerformanceCard eventId={event._id} compact />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ─── Event Calendar ─── */}
      <EventCalendar events={allEvents} />

      {/* ─── Event Form Modal ─── */}
      <EventForm
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditingEvent(null); }}
        onSubmit={handleFormSubmit}
        editEvent={editingEvent}
      />

      {/* ─── Delete Confirmation Modal ─── */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Event">
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
          Are you sure you want to delete <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget?.eventName}</strong>?
          This action cannot be undone.
        </p>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
        </div>
      </Modal>
    </div>
  );
}
