import React, { useState } from 'react'

const INITIAL_TASKS = [
  {
    id: '1',
    taskTitle: 'Review project architecture and requirements',
    priority: 'high',
    isCompleted: true,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: '2',
    taskTitle: 'Design dark theme UI components and typography',
    priority: 'medium',
    isCompleted: false,
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    id: '3',
    taskTitle: 'Set up automated test suite and environment variables',
    priority: 'low',
    isCompleted: false,
    createdAt: new Date().toISOString(),
  },
]

export default function App() {
  const [tasks, setTasks] = useState(INITIAL_TASKS)
  const [taskTitle, setTaskTitle] = useState('')
  const [priority, setPriority] = useState('medium')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  const handleAddTask = (e) => {
    e.preventDefault()
    if (!taskTitle.trim()) return

    const newTask = {
      id: Date.now().toString(),
      taskTitle: taskTitle.trim(),
      priority,
      isCompleted: false,
      createdAt: new Date().toISOString(),
    }

    setTasks([newTask, ...tasks])
    setTaskTitle('')
    setPriority('medium')
  }

  const toggleTaskComplete = (id) => {
    setTasks(
      tasks.map((task) =>
        task.id === id ? { ...task, isCompleted: !task.isCompleted } : task
      )
    )
  }

  const deleteTask = (id) => {
    setTasks(tasks.filter((task) => task.id !== id))
  }

  const clearCompleted = () => {
    setTasks(tasks.filter((task) => !task.isCompleted))
  }

  const filteredTasks = tasks.filter((task) => {
    const matchesStatus =
      filterStatus === 'all'
        ? true
        : filterStatus === 'completed'
        ? task.isCompleted
        : !task.isCompleted

    const matchesPriority =
      filterPriority === 'all' ? true : task.priority === filterPriority

    const matchesSearch = task.taskTitle
      .toLowerCase()
      .includes(searchTerm.toLowerCase())

    return matchesStatus && matchesPriority && matchesSearch
  })

  const completedCount = tasks.filter((t) => t.isCompleted).length
  const totalCount = tasks.length
  const completionPercentage =
    totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100)

  const priorityStyles = {
    high: {
      badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      dot: 'bg-rose-500',
      label: 'High',
    },
    medium: {
      badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      dot: 'bg-amber-500',
      label: 'Medium',
    },
    low: {
      badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      dot: 'bg-emerald-500',
      label: 'Low',
    },
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-start py-10 px-4 sm:px-6">
      <div className="w-full max-w-2xl space-y-8">
        
        {/* Header Section */}
        <header className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Tasks</h1>
            </div>
            
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
              {completedCount} / {totalCount} Completed
            </span>
          </div>
          <p className="text-sm text-zinc-400">
            Manage to-do tasks, set priorities, and track completion.
          </p>

          {/* Minimal Progress Bar */}
          <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden border border-zinc-800/80 mt-2">
            <div
              className="bg-indigo-500 h-full transition-all duration-300 ease-out"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </header>

        {/* Task Creation Form */}
        <section className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-4 sm:p-5 shadow-xl backdrop-blur-sm">
          <form onSubmit={handleAddTask} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label htmlFor="taskTitle" className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Task Description
                </label>
                <input
                  id="taskTitle"
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="What needs to be done?"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="w-full sm:w-36">
                <label htmlFor="priority" className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Priority Level
                </label>
                <select
                  id="priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors cursor-pointer"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={!taskTitle.trim()}
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-sm font-medium rounded-lg transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Task
              </button>
            </div>
          </form>
        </section>

        {/* Filters and Search Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs text-zinc-400">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Filter by keyword..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            {/* Status Segmented Control */}
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-1">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  filterStatus === 'all' ? 'bg-zinc-800 text-zinc-100 font-medium' : 'hover:text-zinc-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterStatus('active')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  filterStatus === 'active' ? 'bg-zinc-800 text-zinc-100 font-medium' : 'hover:text-zinc-200'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setFilterStatus('completed')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  filterStatus === 'completed' ? 'bg-zinc-800 text-zinc-100 font-medium' : 'hover:text-zinc-200'
                }`}
              >
                Completed
              </button>
            </div>

            {/* Priority Filter */}
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>
        </div>

        {/* Task List */}
        <main className="space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
            <span>Task List ({filteredTasks.length})</span>
            {completedCount > 0 && (
              <button
                onClick={clearCompleted}
                className="text-zinc-400 hover:text-rose-400 transition-colors"
              >
                Clear completed
              </button>
            )}
          </div>

          {filteredTasks.length === 0 ? (
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-8 text-center space-y-2">
              <div className="mx-auto w-10 h-10 rounded-full bg-zinc-800/50 flex items-center justify-center text-zinc-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p className="text-sm font-medium text-zinc-400">No tasks found</p>
              <p className="text-xs text-zinc-600">
                {tasks.length === 0
                  ? 'Add a task above to get started.'
                  : 'Try adjusting your search or priority filter.'}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {filteredTasks.map((task) => {
                const priorityInfo = priorityStyles[task.priority] || priorityStyles.medium

                return (
                  <li
                    key={task.id}
                    className={`group bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 rounded-xl p-3.5 flex items-center justify-between gap-3 transition-all duration-150 ${
                      task.isCompleted ? 'opacity-65' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => toggleTaskComplete(task.id)}
                        aria-label="Mark Complete"
                        className={`flex-shrink-0 w-5 h-5 rounded border transition-colors flex items-center justify-center focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                          task.isCompleted
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-zinc-950 border-zinc-700 hover:border-zinc-500 text-transparent'
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                      </button>

                      {/* Title */}
                      <span
                        onClick={() => toggleTaskComplete(task.id)}
                        className={`text-sm select-none truncate cursor-pointer transition-colors ${
                          task.isCompleted
                            ? 'line-through text-zinc-500'
                            : 'text-zinc-200 group-hover:text-zinc-100'
                        }`}
                      >
                        {task.taskTitle}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 flex-shrink-0">
                      {/* Priority Badge */}
                      <span
                        className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${priorityInfo.badge}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${priorityInfo.dot}`} />
                        <span>{priorityInfo.label}</span>
                      </span>

                      {/* Delete Button */}
                      <button
                        onClick={() => deleteTask(task.id)}
                        title="Delete task"
                        className="text-zinc-600 hover:text-rose-400 p-1 rounded-md hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
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
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </main>
      </div>
    </div>
  )
}