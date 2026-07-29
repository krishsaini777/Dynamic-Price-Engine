import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * EventCalendar — Month-view calendar showing event coverage.
 * No external library — vanilla JS Date.
 *
 * Supports two usage modes:
 *   1. events prop (array of all events, any status) — legacy/simple mode
 *   2. activeEvents/upcomingEvents/pastEvents props — three-category mode
 *
 * Props:
 *   events         — array of all events (any status) [optional]
 *   activeEvents   — array of active events (green dots) [optional]
 *   upcomingEvents — array of upcoming events (blue dots) [optional]
 *   pastEvents     — array of past events (red dots) [optional]
 */
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function EventCalendar({
  events = [],
  activeEvents = [],
  upcomingEvents = [],
  pastEvents = [],
}) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const monthName = new Date(year, month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const calendarData = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [year, month]);

  // Support both the unified `events` prop and the separate category props
  const dayEventMap = useMemo(() => {
    const map = {};
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const addEvents = (evtList, statusOverride) => {
      for (const event of evtList) {
        const start = new Date(event.startDate);
        const end = new Date(event.endDate);
        for (let d = 1; d <= daysInMonth; d++) {
          const cellDate = new Date(year, month, d);
          const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
          const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
          if (cellDate >= startDay && cellDate <= endDay) {
            if (!map[d]) map[d] = new Set();
            map[d].add(statusOverride || event.status);
          }
        }
      }
    };

    if (events.length > 0) {
      addEvents(events, null);
    } else {
      addEvents(activeEvents, 'ACTIVE');
      addEvents(upcomingEvents, 'SCHEDULED');
      addEvents(pastEvents, 'EXPIRED');
    }

    return map;
  }, [events, activeEvents, upcomingEvents, pastEvents, year, month]);

  const isToday = (day) => {
    const now = new Date();
    return day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
  };

  const dotColors = {
    ACTIVE: 'var(--accent-green)',
    SCHEDULED: 'var(--accent-blue)',
    DRAFT: '#64748b',
    EXPIRED: 'var(--accent-red)',
    INACTIVE: '#64748b',
  };

  return (
    <div className="card" style={{ padding: '1.25rem', marginTop: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Promotion Calendar</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={prevMonth} style={{ padding: '0.25rem' }}><ChevronLeft size={16} /></button>
          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', minWidth: 120, textAlign: 'center' }}>{monthName}</span>
          <button className="btn btn-secondary btn-sm" onClick={nextMonth} style={{ padding: '0.25rem' }}><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Day names header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '0.25rem' }}>
        {DAY_NAMES.map((d) => (
          <div key={d} style={{ textAlign: 'center', fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '0.35rem 0' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {calendarData.map((day, i) => (
          <div
            key={i}
            style={{
              minHeight: 48, padding: '0.25rem',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              borderRadius: 6,
              background: isToday(day) ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              border: isToday(day) ? '1px solid var(--accent-indigo)' : '1px solid transparent',
            }}
          >
            {day && (
              <>
                <span style={{
                  fontSize: '0.8rem', fontWeight: isToday(day) ? 700 : 400,
                  color: isToday(day) ? 'var(--accent-indigo)' : 'var(--text-primary)',
                }}>
                  {day}
                </span>
                {/* Event dots */}
                {dayEventMap[day] && (
                  <div style={{ display: 'flex', gap: '3px', marginTop: '2px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {[...dayEventMap[day]].map((status) => (
                      <div
                        key={status}
                        title={status}
                        style={{
                          width: status === 'EXPIRED' ? 5 : 6,
                          height: status === 'EXPIRED' ? 5 : 6,
                          borderRadius: '50%',
                          background: dotColors[status] || '#64748b',
                        }}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', justifyContent: 'center' }}>
        {[['Active', 'var(--accent-green)'], ['Upcoming', 'var(--accent-blue)'], ['Past', 'var(--accent-red)']].map(([label, color]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
