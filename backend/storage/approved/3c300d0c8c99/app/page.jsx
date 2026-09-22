'use client';

import { useState, useMemo } from 'react';

export default function EventSchedulerPage() {
  // Initial state with mock events
  const [events, setEvents] = useState([
    {
      id: '1',
      title: 'Q4 Product Roadmap Alignment',
      date: '2025-11-05T10:00',
      location: 'Conference Room A & Zoom',
    },
    {
      id: '2',
      title: 'Design System Workshop',
      date: '2025-11-08T14:30',
      location: 'Innovation Hub, Floor 3',
    },
    {
      id: '3',
      title: 'Annual Tech Summit 2025',
      date: '2025-11-15T09:00',
      location: 'Grand City Convention Center',
    },
    {
      id: '4',
      title: 'Team Thanksgiving Lunch',
      date: '2025-11-20T12:00',
      location: 'The Green Bistro',
    },
  ]);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    location: '',
  });
  const [formError, setFormError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Table filter & sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'

  // Handle Form Submission
  const handleCreateEvent = (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.date || !formData.location.trim()) {
      setFormError('Please fill in all fields (Title, Date, and Location).');
      return;
    }

    const newEvent = {
      id: Date.now().toString(),
      title: formData.title.trim(),
      date: formData.date,
      location: formData.location.trim(),
    };

    setEvents((prev) => [...prev, newEvent]);
    setFormData({ title: '', date: '', location: '' });
    setFormError('');

    // Trigger Toast Notification
    setToastMessage('Event successfully scheduled!');
    setTimeout(() => {
      setToastMessage('');
    }, 3500);
  };

  // Handle Delete Event
  const handleDeleteEvent = (id) => {
    setEvents((prev) => prev.filter((event) => event.id !== id));
  };

  // Handle Sort Toggle
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Process and Filter Events
  const filteredAndSortedEvents = useMemo(() => {
    return events
      .filter((event) => {
        const query = searchQuery.toLowerCase();
        return (
          event.title.toLowerCase().includes(query) ||
          event.location.toLowerCase().includes(query) ||
          event.date.includes(query)
        );
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (sortField === 'date') {
          valA = new Date(a.date).getTime() || 0;
          valB = new Date(b.date).getTime() || 0;
        } else {
          valA = String(valA).toLowerCase();
          valB = String(valB).toLowerCase();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
  }, [events, searchQuery, sortField, sortDirection]);

  // Date Formatter helper
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const dateObj = new Date(dateString);
      if (isNaN(dateObj.getTime())) return dateString;
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(dateObj);
    } catch {
      return dateString;
    }
  };

  // Next upcoming event for highlight stat
  const nextEvent = useMemo(() => {
    const now = new Date();
    const upcoming = events
      .filter((e) => new Date(e.date) >= now)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    return upcoming[0] || events[0] || null;
  }, [events]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg border border-emerald-500 animate-bounce transition-all">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900">Event Scheduler</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors border border-blue-200 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Dashboard
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header / Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Scheduled</p>
              <p className="text-2xl font-bold text-slate-900">{events.length} Events</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Next Upcoming Event</p>
              <p className="text-sm font-semibold text-slate-900 truncate max-w-[200px]">
                {nextEvent ? nextEvent.title : 'None scheduled'}
              </p>
              {nextEvent && (
                <p className="text-xs text-slate-500 truncate">{formatDate(nextEvent.date)}</p>
              )}
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Locations</p>
              <p className="text-2xl font-bold text-slate-900">
                {new Set(events.map((e) => e.location)).size} Venues
              </p>
            </div>
          </div>
        </div>

        {/* Form and List Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Card: Create New Event */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:col-span-1 sticky top-24">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                +
              </div>
              <h2 className="text-lg font-bold text-slate-900">Create New Event</h2>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label htmlFor="event-title" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Event Title
                </label>
                <input
                  id="event-title"
                  type="text"
                  placeholder="e.g. Quarterly Team Sync"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 placeholder-slate-400"
                />
              </div>

              <div>
                <label htmlFor="event-date" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Event Date & Time
                </label>
                <input
                  id="event-date"
                  type="datetime-local"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 placeholder-slate-400"
                />
              </div>

              <div>
                <label htmlFor="event-location" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Location
                </label>
                <input
                  id="event-location"
                  type="text"
                  placeholder="e.g. Main Hall or Virtual Link"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 placeholder-slate-400"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Event
              </button>
            </form>
          </div>

          {/* Table: Scheduled Events List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden lg:col-span-2">
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Scheduled Events List</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing {filteredAndSortedEvents.length} of {events.length} total events
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Filter events or venue..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 placeholder-slate-400"
                />
                <svg
                  className="w-4 h-4 text-slate-400 absolute left-3 top-2.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th
                      scope="col"
                      className="py-3.5 px-4 cursor-pointer hover:bg-slate-200 transition-colors"
                      onClick={() => handleSort('title')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Event Title</span>
                        {sortField === 'title' && (
                          <span className="text-blue-600 font-bold">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th
                      scope="col"
                      className="py-3.5 px-4 cursor-pointer hover:bg-slate-200 transition-colors"
                      onClick={() => handleSort('date')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Date & Time</span>
                        {sortField === 'date' && (
                          <span className="text-blue-600 font-bold">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th
                      scope="col"
                      className="py-3.5 px-4 cursor-pointer hover:bg-slate-200 transition-colors"
                      onClick={() => handleSort('location')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Location</span>
                        {sortField === 'location' && (
                          <span className="text-blue-600 font-bold">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th scope="col" className="py-3.5 px-4 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredAndSortedEvents.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="font-medium text-slate-600">No events found</p>
                          <p className="text-xs text-slate-400">
                            {events.length === 0
                              ? 'Get started by creating your first scheduled event above.'
                              : 'Try adjusting your search query.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredAndSortedEvents.map((evt) => (
                      <tr key={evt.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="py-4 px-4 font-semibold text-slate-900">
                          {evt.title}
                        </td>
                        <td className="py-4 px-4 text-slate-600 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="font-medium text-slate-800">{formatDate(evt.date)}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>{evt.location}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteEvent(evt.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex items-center gap-1"
                            title="Remove event"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer / Helper */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <p>Click column header to sort table by Title, Date, or Location.</p>
              <p>Sorted by <span className="font-semibold capitalize text-slate-700">{sortField} ({sortDirection})</span></p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}