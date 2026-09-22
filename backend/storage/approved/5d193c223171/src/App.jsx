import React, { useState, useMemo } from 'react';

const INITIAL_ENTRIES = [
  {
    id: 1,
    year: 2024,
    quarter: 'Q1',
    category: 'Enterprise Subscriptions',
    amount: 450000,
    target: 400000,
    date: '2024-03-31',
    status: 'Completed',
    notes: 'Exceeded Q1 target driven by enterprise contract renewals.'
  },
  {
    id: 2,
    year: 2024,
    quarter: 'Q2',
    category: 'Professional Services',
    amount: 380000,
    target: 420000,
    date: '2024-06-30',
    status: 'Completed',
    notes: 'Slightly below target due to delayed onboarding cycles.'
  },
  {
    id: 3,
    year: 2024,
    quarter: 'Q3',
    category: 'Enterprise Subscriptions',
    amount: 520000,
    target: 480000,
    date: '2024-09-30',
    status: 'Completed',
    notes: 'Strong expansion revenue in mid-market segment.'
  },
  {
    id: 4,
    year: 2024,
    quarter: 'Q4',
    category: 'SMB & Self-Serve',
    amount: 610000,
    target: 550000,
    date: '2024-12-31',
    status: 'Completed',
    notes: 'Year-end promo campaign boosted self-serve upgrades.'
  },
  {
    id: 5,
    year: 2025,
    quarter: 'Q1',
    category: 'Enterprise Subscriptions',
    amount: 490000,
    target: 500000,
    date: '2025-03-15',
    status: 'In Progress',
    notes: 'Current quarter ongoing; key deals closing late March.'
  }
];

const CATEGORIES = [
  'Enterprise Subscriptions',
  'Professional Services',
  'SMB & Self-Serve',
  'Partnerships & Licensing',
  'Other Revenue'
];

export default function App() {
  const [entries, setEntries] = useState(INITIAL_ENTRIES);
  const [selectedYear, setSelectedYear] = useState('All');
  const [selectedQuarter, setSelectedQuarter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    year: new Date().getFullYear(),
    quarter: 'Q1',
    category: 'Enterprise Subscriptions',
    amount: '',
    target: '',
    date: new Date().toISOString().split('T')[0],
    status: 'Completed',
    notes: ''
  });

  // Available Years
  const availableYears = useMemo(() => {
    const years = Array.from(new Set(entries.map((e) => e.year)));
    years.sort((a, b) => b - a);
    return years;
  }, [entries]);

  // Filtered Entries
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchYear = selectedYear === 'All' || entry.year === Number(selectedYear);
      const matchQuarter = selectedQuarter === 'All' || entry.quarter === selectedQuarter;
      const matchSearch =
        entry.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.notes.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.quarter.toLowerCase().includes(searchQuery.toLowerCase());
      return matchYear && matchQuarter && matchSearch;
    });
  }, [entries, selectedYear, selectedQuarter, searchQuery]);

  // Aggregated Metrics
  const stats = useMemo(() => {
    const totalAmount = filteredEntries.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const totalTarget = filteredEntries.reduce((sum, e) => sum + Number(e.target || 0), 0);
    const achievementRate = totalTarget > 0 ? (totalAmount / totalTarget) * 100 : 0;
    const avgPerQuarter = filteredEntries.length > 0 ? totalAmount / filteredEntries.length : 0;

    return {
      totalAmount,
      totalTarget,
      achievementRate,
      avgPerQuarter,
      count: filteredEntries.length
    };
  }, [filteredEntries]);

  // Handle Modal Open
  const handleOpenModal = (entry = null) => {
    if (entry) {
      setEditingId(entry.id);
      setFormData({
        year: entry.year,
        quarter: entry.quarter,
        category: entry.category,
        amount: entry.amount,
        target: entry.target,
        date: entry.date,
        status: entry.status,
        notes: entry.notes
      });
    } else {
      setEditingId(null);
      setFormData({
        year: new Date().getFullYear(),
        quarter: 'Q1',
        category: 'Enterprise Subscriptions',
        amount: '',
        target: '',
        date: new Date().toISOString().split('T')[0],
        status: 'Completed',
        notes: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.target) return;

    if (editingId) {
      setEntries((prev) =>
        prev.map((item) =>
          item.id === editingId
            ? {
                ...item,
                ...formData,
                year: Number(formData.year),
                amount: Number(formData.amount),
                target: Number(formData.target)
              }
            : item
        )
      );
    } else {
      const newEntry = {
        id: Date.now(),
        ...formData,
        year: Number(formData.year),
        amount: Number(formData.amount),
        target: Number(formData.target)
      };
      setEntries((prev) => [newEntry, ...prev]);
    }

    handleCloseModal();
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this revenue log entry?')) {
      setEntries((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12 font-sans antialiased">
      {/* Top Header Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-sm">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-none">
                Quarterly Revenue Tracker
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Monitor performance, targets, and quarterly entries
              </p>
            </div>
          </div>

          <button
            onClick={() => handleOpenModal()}
            className="zx-marker-btn bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-4 py-2.5 rounded-lg shadow transition-all duration-150 flex items-center space-x-2 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>Log Entry</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Revenue
              </span>
              <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-900">
                {formatCurrency(stats.totalAmount)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Target: {formatCurrency(stats.totalTarget)}
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Target Attainment
              </span>
              <span className="p-1.5 bg-blue-50 text-blue-600 rounded-md">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-900">
                {stats.achievementRate.toFixed(1)}%
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    stats.achievementRate >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'
                  }`}
                  style={{ width: `${Math.min(stats.achievementRate, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Avg / Quarter
              </span>
              <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-900">
                {formatCurrency(stats.avgPerQuarter)}
              </div>
              <p className="text-xs text-slate-500 mt-1">Across {stats.count} filtered log entries</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Logged Quarters
              </span>
              <span className="p-1.5 bg-amber-50 text-amber-600 rounded-md">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-900">{filteredEntries.length}</div>
              <p className="text-xs text-slate-500 mt-1">Active period logs recorded</p>
            </div>
          </div>
        </div>

        {/* Main Card Component section */}
        <div className="zx-marker-card bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Card Header & Controls */}
          <div className="p-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Quarterly Revenue Tracker</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Review quarterly financial metrics, actuals vs target performance, and details.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[180px] sm:w-64">
                <input
                  type="text"
                  placeholder="Search entries..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
                <svg
                  className="w-4 h-4 absolute left-3 top-2.5 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>

              {/* Year Selector */}
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-medium"
              >
                <option value="All">All Years</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    Year {yr}
                  </option>
                ))}
              </select>

              {/* Quarter Selector */}
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(e.target.value)}
                className="px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-medium"
              >
                <option value="All">All Quarters</option>
                <option value="Q1">Q1</option>
                <option value="Q2">Q2</option>
                <option value="Q3">Q3</option>
                <option value="Q4">Q4</option>
              </select>

              {/* Log Entry Action Button */}
              <button
                onClick={() => handleOpenModal()}
                className="zx-marker-btn bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg shadow-sm transition-colors flex items-center space-x-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                <span>Log Entry</span>
              </button>
            </div>
          </div>

          {/* Visual Performance Bars Section */}
          {filteredEntries.length > 0 && (
            <div className="bg-slate-50 p-6 border-b border-slate-200">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
                Quarterly Target vs Actual Overview
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {['Q1', 'Q2', 'Q3', 'Q4'].map((qtr) => {
                  const qtrItems = filteredEntries.filter((e) => e.quarter === qtr);
                  const qtrAmount = qtrItems.reduce((acc, curr) => acc + Number(curr.amount), 0);
                  const qtrTarget = qtrItems.reduce((acc, curr) => acc + Number(curr.target), 0);
                  const qtrPercent = qtrTarget > 0 ? Math.round((qtrAmount / qtrTarget) * 100) : 0;

                  return (
                    <div key={qtr} className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
                      <div className="flex items-center justify-between text-xs font-semibold mb-1">
                        <span className="text-slate-700">{qtr} Summary</span>
                        <span
                          className={
                            qtrPercent >= 100
                              ? 'text-emerald-600 font-bold'
                              : 'text-indigo-600 font-bold'
                          }
                        >
                          {qtrPercent}% Target
                        </span>
                      </div>
                      <div className="text-lg font-bold text-slate-900 mb-2">
                        {formatCurrency(qtrAmount)}
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            qtrPercent >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'
                          }`}
                          style={{ width: `${Math.min(qtrPercent, 100)}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-400 mt-2">
                        <span>Actual: {formatCurrency(qtrAmount)}</span>
                        <span>Target: {formatCurrency(qtrTarget)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Entries Data Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                  <th className="py-3.5 px-6">Period</th>
                  <th className="py-3.5 px-6">Category</th>
                  <th className="py-3.5 px-6">Target</th>
                  <th className="py-3.5 px-6">Actual Revenue</th>
                  <th className="py-3.5 px-6">Attainment</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6">Notes</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-400">
                      <svg
                        className="w-12 h-12 mx-auto mb-3 text-slate-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.5"
                          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <p className="text-slate-600 font-medium text-base">No revenue logs found</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Try adjusting your filters or log a new entry.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((item) => {
                    const percent =
                      item.target > 0 ? Math.round((item.amount / item.target) * 100) : 0;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-6 font-semibold text-slate-900 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-800 mr-2">
                            {item.year}
                          </span>
                          {item.quarter}
                        </td>
                        <td className="py-4 px-6 text-slate-700 whitespace-nowrap">
                          {item.category}
                        </td>
                        <td className="py-4 px-6 text-slate-600 font-mono whitespace-nowrap">
                          {formatCurrency(item.target)}
                        </td>
                        <td className="py-4 px-6 font-bold font-mono text-slate-900 whitespace-nowrap">
                          {formatCurrency(item.amount)}
                        </td>
                        <td className="py-4 px-6 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                              percent >= 100
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {percent}%
                          </span>
                        </td>
                        <td className="py-4 px-6 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              item.status === 'Completed'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : item.status === 'In Progress'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-slate-500 max-w-xs truncate" title={item.notes}>
                          {item.notes || '—'}
                        </td>
                        <td className="py-4 px-6 text-right whitespace-nowrap space-x-2">
                          <button
                            onClick={() => handleOpenModal(item)}
                            className="text-slate-400 hover:text-indigo-600 p-1 rounded transition-colors"
                            title="Edit entry"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                            title="Delete entry"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Log Entry Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-base font-bold text-slate-900">
                {editingId ? 'Edit Revenue Entry' : 'Log New Revenue Entry'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Year
                  </label>
                  <input
                    type="number"
                    required
                    min="2020"
                    max="2030"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Quarter
                  </label>
                  <select
                    value={formData.quarter}
                    onChange={(e) => setFormData({ ...formData, quarter: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none"
                  >
                    <option value="Q1">Q1</option>
                    <option value="Q2">Q2</option>
                    <option value="Q3">Q3</option>
                    <option value="Q4">Q4</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Revenue Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Target Revenue ($)
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="1000"
                    placeholder="e.g. 500000"
                    value={formData.target}
                    onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Actual Revenue ($)
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="1000"
                    placeholder="e.g. 520000"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none"
                  >
                    <option value="Completed">Completed</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Projected">Projected</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Entry Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Notes / Description
                </label>
                <textarea
                  rows="3"
                  placeholder="Additional context or drivers behind performance..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none"
                ></textarea>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-5 py-2 rounded-lg shadow-sm transition-colors"
                >
                  {editingId ? 'Save Changes' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}