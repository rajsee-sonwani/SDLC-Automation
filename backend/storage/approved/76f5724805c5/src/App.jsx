import React, { useState, useMemo } from 'react';

const INITIAL_GOAL = 500000;

const DEFAULT_QUARTER_TARGETS = {
  Q1: 100000,
  Q2: 125000,
  Q3: 125000,
  Q4: 150000,
};

const INITIAL_ENTRIES = [
  {
    id: '1',
    date: '2025-01-15',
    quarter: 'Q1',
    source: 'Acme Corp - Enterprise Renewal',
    category: 'Subscription',
    amount: 45000,
    status: 'Paid',
    notes: 'Annual upfront payment'
  },
  {
    id: '2',
    date: '2025-02-10',
    quarter: 'Q1',
    source: 'Starlight Tech - Consulting',
    category: 'Services',
    amount: 28000,
    status: 'Paid',
    notes: 'Q1 Migration advisory'
  },
  {
    id: '3',
    date: '2025-03-22',
    quarter: 'Q1',
    source: 'Apex Labs - Custom Add-on',
    category: 'Product',
    amount: 32000,
    status: 'Paid',
    notes: 'Custom feature rollout'
  },
  {
    id: '4',
    date: '2025-04-05',
    quarter: 'Q2',
    source: 'Nexus Systems - Expansion',
    category: 'Subscription',
    amount: 55000,
    status: 'Paid',
    notes: 'Added 50 seats'
  },
  {
    id: '5',
    date: '2025-05-18',
    quarter: 'Q2',
    source: 'Vortex Media - Implementation',
    category: 'Services',
    amount: 42000,
    status: 'Pending',
    notes: 'Invoiced, due in 15 days'
  },
  {
    id: '6',
    date: '2025-07-12',
    quarter: 'Q3',
    source: 'Global Dynamics - SLA Support',
    category: 'Subscription',
    amount: 60000,
    status: 'Paid',
    notes: 'Tier 1 priority support package'
  },
  {
    id: '7',
    date: '2025-10-02',
    quarter: 'Q4',
    source: 'Horizon Health - Pilot Program',
    category: 'Consulting',
    amount: 35000,
    status: 'Forecasted',
    notes: 'Expected close late Q4'
  }
];

export default function App() {
  const [entries, setEntries] = useState(INITIAL_ENTRIES);
  const [selectedQuarter, setSelectedQuarter] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    source: '',
    amount: '',
    quarter: 'Q1',
    date: new Date().toISOString().split('T')[0],
    category: 'Subscription',
    status: 'Paid',
    notes: ''
  });

  // Calculate totals and statistics
  const stats = useMemo(() => {
    const totalRevenue = entries.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const paidRevenue = entries
      .filter(e => e.status === 'Paid')
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const pendingRevenue = entries
      .filter(e => e.status === 'Pending')
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    const quarterTotals = {
      Q1: 0,
      Q2: 0,
      Q3: 0,
      Q4: 0
    };

    entries.forEach(entry => {
      if (quarterTotals[entry.quarter] !== undefined) {
        quarterTotals[entry.quarter] += Number(entry.amount) || 0;
      }
    });

    return {
      totalRevenue,
      paidRevenue,
      pendingRevenue,
      quarterTotals,
      overallProgress: Math.min(Math.round((totalRevenue / INITIAL_GOAL) * 100), 100)
    };
  }, [entries]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const matchesQuarter = selectedQuarter === 'All' || entry.quarter === selectedQuarter;
      const matchesCategory = selectedCategory === 'All' || entry.category === selectedCategory;
      const matchesStatus = selectedStatus === 'All' || entry.status === selectedStatus;
      const matchesSearch = 
        entry.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.notes.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesQuarter && matchesCategory && matchesStatus && matchesSearch;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [entries, selectedQuarter, selectedCategory, selectedStatus, searchTerm]);

  // Open modal for new entry
  const handleOpenAddModal = () => {
    setEditingEntry(null);
    setFormData({
      source: '',
      amount: '',
      quarter: selectedQuarter !== 'All' ? selectedQuarter : 'Q1',
      date: new Date().toISOString().split('T')[0],
      category: 'Subscription',
      status: 'Paid',
      notes: ''
    });
    setIsModalOpen(true);
  };

  // Open modal for edit
  const handleOpenEditModal = (entry) => {
    setEditingEntry(entry);
    setFormData({
      source: entry.source,
      amount: entry.amount.toString(),
      quarter: entry.quarter,
      date: entry.date,
      category: entry.category,
      status: entry.status,
      notes: entry.notes || ''
    });
    setIsModalOpen(true);
  };

  // Delete Entry
  const handleDeleteEntry = (id) => {
    if (window.confirm('Are you sure you want to delete this revenue entry?')) {
      setEntries(prev => prev.filter(item => item.id !== id));
    }
  };

  // Save Entry (Add or Update)
  const handleSaveEntry = (e) => {
    e.preventDefault();
    if (!formData.source || !formData.amount || isNaN(formData.amount)) return;

    if (editingEntry) {
      setEntries(prev => prev.map(item => item.id === editingEntry.id ? {
        ...item,
        source: formData.source,
        amount: parseFloat(formData.amount),
        quarter: formData.quarter,
        date: formData.date,
        category: formData.category,
        status: formData.status,
        notes: formData.notes
      } : item));
    } else {
      const newEntry = {
        id: Date.now().toString(),
        source: formData.source,
        amount: parseFloat(formData.amount),
        quarter: formData.quarter,
        date: formData.date,
        category: formData.category,
        status: formData.status,
        notes: formData.notes
      };
      setEntries(prev => [newEntry, ...prev]);
    }

    setIsModalOpen(false);
  };

  // Helper for status badge color
  const getStatusBadge = (status) => {
    switch (status) {
      case 'Paid':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Pending':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Forecasted':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  // Auto-set quarter based on date selection
  const handleDateChange = (e) => {
    const newDate = e.target.value;
    if (!newDate) return;
    const month = new Date(newDate).getMonth() + 1;
    let autoQuarter = 'Q1';
    if (month >= 1 && month <= 3) autoQuarter = 'Q1';
    else if (month >= 4 && month <= 6) autoQuarter = 'Q2';
    else if (month >= 7 && month <= 9) autoQuarter = 'Q3';
    else if (month >= 10 && month <= 12) autoQuarter = 'Q4';

    setFormData(prev => ({
      ...prev,
      date: newDate,
      quarter: autoQuarter
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Top Header & Overview */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 bg-indigo-600 rounded-full animate-pulse"></span>
              <span className="text-xs font-bold tracking-wider text-indigo-600 uppercase">Financial Dashboard</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
              Quarterly Revenue Tracker
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Track, organize, and forecast performance across all four financial quarters.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 px-5 text-right flex-1 md:flex-initial">
              <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Annual Goal</span>
              <span className="text-lg font-bold text-slate-800">${INITIAL_GOAL.toLocaleString()}</span>
            </div>

            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 px-5 text-right flex-1 md:flex-initial">
              <span className="block text-xs font-semibold text-indigo-600 uppercase tracking-wider">Total Revenue</span>
              <span className="text-lg font-extrabold text-indigo-700">${stats.totalRevenue.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Quarterly Breakdown Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => {
            const actual = stats.quarterTotals[q];
            const target = DEFAULT_QUARTER_TARGETS[q];
            const pct = Math.min(Math.round((actual / target) * 100), 100);
            const isSelected = selectedQuarter === q;

            return (
              <div 
                key={q} 
                onClick={() => setSelectedQuarter(selectedQuarter === q ? 'All' : q)}
                className={`cursor-pointer transition-all duration-200 rounded-xl p-5 border bg-white shadow-sm hover:shadow-md ${
                  isSelected ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50/20' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-slate-700">{q} Target</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    actual >= target ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {pct}% Reached
                  </span>
                </div>
                <div className="text-xl font-bold text-slate-900">${actual.toLocaleString()}</div>
                <div className="text-xs text-slate-500 mt-0.5">Target: ${target.toLocaleString()}</div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      actual >= target ? 'bg-emerald-500' : 'bg-indigo-600'
                    }`}
                    style={{ width: `${pct}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Main Section Card (UX Reference Marker) */}
        <div className="zx-marker-card bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Card Header */}
          <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Quarterly Revenue Tracker</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Showing {filteredEntries.length} of {entries.length} logged entries
              </p>
            </div>

            <button 
              onClick={handleOpenAddModal}
              className="zx-marker-btn inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <svg className="w-4 h-4 stroke-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>Log Entry</span>
            </button>
          </div>

          {/* Filters and Controls */}
          <div className="p-4 sm:p-6 bg-slate-50/50 border-b border-slate-200 flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search source or notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Quarter Filter */}
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="All">All Quarters</option>
                <option value="Q1">Q1</option>
                <option value="Q2">Q2</option>
                <option value="Q3">Q3</option>
                <option value="Q4">Q4</option>
              </select>

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="All">All Categories</option>
                <option value="Subscription">Subscription</option>
                <option value="Services">Services</option>
                <option value="Product">Product</option>
                <option value="Consulting">Consulting</option>
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="All">All Statuses</option>
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
                <option value="Forecasted">Forecasted</option>
              </select>

              {(selectedQuarter !== 'All' || selectedCategory !== 'All' || selectedStatus !== 'All' || searchTerm) && (
                <button
                  onClick={() => {
                    setSelectedQuarter('All');
                    setSelectedCategory('All');
                    setSelectedStatus('All');
                    setSearchTerm('');
                  }}
                  className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Revenue Entries Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-100/70 text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 font-semibold">Date</th>
                  <th className="px-6 py-3 font-semibold">Source / Client</th>
                  <th className="px-6 py-3 font-semibold">Quarter</th>
                  <th className="px-6 py-3 font-semibold">Category</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold text-right">Amount</th>
                  <th className="px-6 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredEntries.length > 0 ? (
                  filteredEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-500">
                        {entry.date}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{entry.source}</div>
                        {entry.notes && (
                          <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">{entry.notes}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                          {entry.quarter}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                        {entry.category}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(entry.status)}`}>
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-slate-900">
                        ${Number(entry.amount).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                        <button
                          onClick={() => handleOpenEditModal(entry)}
                          className="text-slate-400 hover:text-indigo-600 transition p-1"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="text-slate-400 hover:text-rose-600 transition p-1"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="font-medium text-slate-500">No revenue entries found.</p>
                        <p className="text-xs text-slate-400">Try adjusting your filters or click "Log Entry" to add one.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Card Footer Summary */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 gap-2">
            <div>
              Showing aggregate view across selected filters.
            </div>
            <div className="font-semibold text-slate-700">
              Filtered Total: ${filteredEntries.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0).toLocaleString()}
            </div>
          </div>
        </div>

      </div>

      {/* Log Entry Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900">
                {editingEntry ? 'Edit Revenue Entry' : 'Log New Revenue Entry'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEntry} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Source / Client Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Corp Contract"
                  value={formData.source}
                  onChange={(e) => setFormData(prev => ({ ...prev, source: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Amount ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={handleDateChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Quarter
                  </label>
                  <select
                    value={formData.quarter}
                    onChange={(e) => setFormData(prev => ({ ...prev, quarter: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Q1">Q1</option>
                    <option value="Q2">Q2</option>
                    <option value="Q3">Q3</option>
                    <option value="Q4">Q4</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Subscription">Subscription</option>
                    <option value="Services">Services</option>
                    <option value="Product">Product</option>
                    <option value="Consulting">Consulting</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                    <option value="Forecasted">Forecasted</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Notes / Description
                </label>
                <textarea
                  rows="3"
                  placeholder="Additional context or contract details..."
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                ></textarea>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
                >
                  {editingEntry ? 'Save Changes' : 'Log Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}