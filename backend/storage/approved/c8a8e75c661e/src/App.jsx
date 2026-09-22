import React, { useState, useEffect } from 'react';

const INITIAL_TASKS = [
  {
    id: '1',
    taskTitle: 'Complete project documentation and architecture review',
    taskPriority: 'high',
    isCompleted: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    taskTitle: 'Review pull requests from team members',
    taskPriority: 'medium',
    isCompleted: false,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: '3',
    taskTitle: 'Update development dependencies',
    taskPriority: 'low',
    isCompleted: true,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

export default function App() {
  const [tasks, setTasks] = useState(() => {
    try {
      const saved = localStorage.getItem('todoapp_tasks');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // Ignore fallback
    }
    return INITIAL_TASKS;
  });

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'active' | 'completed'
  const [filterPriority, setFilterPriority] = useState('all'); // 'all' | 'high' | 'medium' | 'low'
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem('todoapp_tasks', JSON.stringify(tasks));
    } catch (e) {
      // Ignore fallback
    }
  }, [tasks]);

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please enter a task title');
      return;
    }
    setError('');

    const newTask = {
      id: Date.now().toString(),
      taskTitle: title.trim(),
      taskPriority: priority,
      isCompleted: false,
      createdAt: new Date().toISOString(),
    };

    setTasks([newTask, ...tasks]);
    setTitle('');
    setPriority('medium');
  };

  const toggleTaskComplete = (id) => {
    setTasks(
      tasks.map((task) =>
        task.id === id ? { ...task, isCompleted: !task.isCompleted } : task
      )
    );
  };

  const deleteTask = (id) => {
    setTasks(tasks.filter((task) => task.id !== id));
  };

  const clearCompleted = () => {
    setTasks(tasks.filter((task) => !task.isCompleted));
  };

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    const matchesStatus =
      filterStatus === 'all'
        ? true
        : filterStatus === 'active'
        ? !task.isCompleted
        : task.isCompleted;

    const matchesPriority =
      filterPriority === 'all' ? true : task.taskPriority === filterPriority;

    const matchesSearch = task.taskTitle
      .toLowerCase()
      .includes(searchQuery.toLowerCase().trim());

    return matchesStatus && matchesPriority && matchesSearch;
  });

  // Task Stats
  const totalCount = tasks.length;
  const completedCount = tasks.filter((t) => t.isCompleted).length;
  const activeCount = totalCount - completedCount;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                TodoApp
              </h1>
              <p className="text-xs text-slate-400">
                Organize tasks with priority levels
              </p>
            </div>
          </div>

          {/* Stat Pill Counter */}
          <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/60 rounded-lg p-1.5 text-xs font-medium">
            <div className="px-2.5 py-1 rounded bg-slate-700/50 text-slate-300">
              Total: <span className="font-bold text-white">{totalCount}</span>
            </div>
            <div className="px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Active: <span className="font-bold">{activeCount}</span>
            </div>
            <div className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Done: <span className="font-bold">{completedCount}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 flex flex-col gap-6">
        {/* Task Input Section (Card) */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
            <svg
              className="w-4 h-4 text-indigo-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Task Input Section
          </h2>

          <form onSubmit={handleAddTask} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              {/* Task Title Field */}
              <div className="sm:col-span-8 flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-300">
                  Task Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="What needs to be done?"
                  className="w-full bg-slate-800/90 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Priority Dropdown */}
              <div className="sm:col-span-4 flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-300">
                  Priority Level
                </label>
                <div className="relative">
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full appearance-none bg-slate-800/90 border border-slate-700 text-slate-100 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all cursor-pointer pr-10"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <p className="text-xs text-rose-400 font-medium flex items-center gap-1.5">
                <svg
                  className="w-3.5 h-3.5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {error}
              </p>
            )}

            {/* Add Task Button */}
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add Task
              </button>
            </div>
          </form>
        </section>

        {/* Filter Controls & Search */}
        <section className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative w-full md:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="w-full bg-slate-800/70 border border-slate-700/60 text-slate-100 placeholder-slate-500 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <svg
              className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          <div className="flex flex-wrap items-center justify-between md:justify-end w-full md:w-auto gap-2">
            {/* Status Filter tabs */}
            <div className="inline-flex bg-slate-800/80 p-1 rounded-lg border border-slate-700/50 text-xs">
              {['all', 'active', 'completed'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-3 py-1 rounded-md capitalize font-medium transition-colors ${
                    filterStatus === status
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            {/* Priority Filter */}
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="bg-slate-800/80 border border-slate-700/50 text-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>
        </section>

        {/* Task List Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-medium text-slate-400">
              Task List ({filteredTasks.length})
            </h2>
            {completedCount > 0 && (
              <button
                onClick={clearCompleted}
                className="text-xs text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Clear Completed
              </button>
            )}
          </div>

          {filteredTasks.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800/60 border-dashed rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-500">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
              <p className="text-slate-400 text-sm font-medium">
                No tasks found
              </p>
              <p className="text-slate-500 text-xs max-w-xs">
                {tasks.length === 0
                  ? 'Get started by creating your first task above.'
                  : 'Try adjusting your search or filters to see more tasks.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {filteredTasks.map((task) => {
                const isHigh = task.taskPriority === 'high';
                const isMedium = task.taskPriority === 'medium';

                return (
                  <div
                    key={task.id}
                    className={`group bg-slate-900 border rounded-xl p-4 transition-all duration-200 flex items-center justify-between gap-3 shadow-md hover:border-slate-700 ${
                      task.isCompleted
                        ? 'border-slate-800/60 bg-slate-900/50 opacity-70'
                        : 'border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      {/* Mark Complete Checkbox */}
                      <button
                        type="button"
                        onClick={() => toggleTaskComplete(task.id)}
                        className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                          task.isCompleted
                            ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                            : 'border-slate-600 hover:border-indigo-400 bg-slate-800'
                        }`}
                        title={
                          task.isCompleted
                            ? 'Mark incomplete'
                            : 'Mark complete'
                        }
                      >
                        {task.isCompleted && (
                          <svg
                            className="w-3.5 h-3.5 stroke-[3]"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </button>

                      {/* Task Title */}
                      <span
                        onClick={() => toggleTaskComplete(task.id)}
                        className={`text-sm select-none truncate cursor-pointer transition-colors ${
                          task.isCompleted
                            ? 'line-through text-slate-500'
                            : 'text-slate-100 font-medium'
                        }`}
                      >
                        {task.taskTitle}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Priority Badge */}
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${
                          isHigh
                            ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                            : isMedium
                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isHigh
                              ? 'bg-rose-400'
                              : isMedium
                              ? 'bg-amber-400'
                              : 'bg-emerald-400'
                          }`}
                        />
                        {task.taskPriority}
                      </span>

                      {/* Delete Task Button */}
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded-md hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Delete task"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 mt-auto">
        <div className="max-w-4xl mx-auto px-4 text-center text-xs text-slate-500">
          TodoApp • Task Management with Priority Levels
        </div>
      </footer>
    </div>
  );
}