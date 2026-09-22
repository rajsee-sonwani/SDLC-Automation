import { useEffect, useRef, useState } from 'react'
import { getProject, listProjects, retryProject } from '../api/client'
import PanelToggleIcon from './PanelToggleIcon.jsx'

const TECH_LABEL = { react: 'React', nextjs: 'Next.js' }

function formatWhen(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const minutes = Math.round((Date.now() - date.getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function ProjectSidebar({ activeProjectId, onSelect }) {
  const [projects, setProjects] = useState([])
  const [error, setError] = useState(null)
  const [loadingId, setLoadingId] = useState(null)
  const [retryingId, setRetryingId] = useState(null)
  // Always starts expanded on page load, deliberately not persisted across
  // reloads -- collapse is a per-session convenience, not a saved preference.
  const [collapsed, setCollapsed] = useState(false)
  const activeRef = useRef(null)

  // With a long history the restored project can sit well below the fold,
  // making the sidebar look like nothing is selected after a reload.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeProjectId, projects])

  // Re-fetched whenever the active project changes, which also covers a newly
  // generated project appearing in the list right after "Generate App".
  useEffect(() => {
    let cancelled = false
    listProjects()
      .then((data) => { if (!cancelled) setProjects(data.projects) })
      .catch((err) => { if (!cancelled) setError(err.message || 'Could not load past projects.') })
    return () => { cancelled = true }
  }, [activeProjectId])

  const handleSelect = async (projectId) => {
    if (projectId === activeProjectId || loadingId) return
    setLoadingId(projectId)
    setError(null)
    try {
      onSelect(await getProject(projectId))
    } catch (err) {
      setError(err.message || 'Could not open that project.')
    } finally {
      setLoadingId(null)
    }
  }

  // Re-attempts generation for a failed ("not generated") project using its
  // already-stored requirement -- no retyping needed. Opens the project
  // afterward so the user immediately sees the result, and re-fetches the
  // list so this row's "not generated" label flips over.
  const handleRetry = async (projectId) => {
    if (retryingId) return
    setRetryingId(projectId)
    setError(null)
    try {
      const refreshed = await retryProject(projectId)
      onSelect(refreshed)
      setProjects((await listProjects()).projects)
    } catch (err) {
      setError(err.message || 'Retry failed.')
    } finally {
      setRetryingId(null)
    }
  }

  return (
    <div className="shrink-0 flex border-b lg:border-b-0 lg:border-r border-slate-200 bg-white">
      {/* Always visible regardless of collapsed state -- per the requirement that
          bringing the sidebar back must stay easy even while it's hidden. */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? 'Show projects' : 'Hide projects'}
        aria-label={collapsed ? 'Show projects' : 'Hide projects'}
        aria-expanded={!collapsed}
        className="shrink-0 w-6 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <PanelToggleIcon />
      </button>

      {/* Slides fully out of view (width -> 0) rather than unmounting, so the
          toggle above can bring it straight back without a refetch. */}
      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          collapsed ? 'w-0 opacity-0' : 'w-full lg:w-[206px] opacity-100'
        }`}
      >
        <aside className="w-full lg:w-[206px] h-full flex flex-col max-h-56 lg:max-h-none">
          <div className="shrink-0 px-3 py-3 border-b border-slate-100">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Projects</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {error && <p className="px-2 py-2 text-xs text-red-600">{error}</p>}
            {!error && projects.length === 0 && (
              <p className="px-2 py-2 text-xs text-slate-400">No projects yet.</p>
            )}
            <ul className="space-y-0.5">
              {projects.map((project) => {
                const isActive = project.project_id === activeProjectId
                return (
                  <li key={project.project_id}>
                    <div
                      className={`flex items-center gap-1 rounded-lg transition-colors ${
                        isActive ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50'
                      }`}
                    >
                      <button
                        type="button"
                        ref={isActive ? activeRef : undefined}
                        onClick={() => handleSelect(project.project_id)}
                        aria-current={isActive ? 'true' : undefined}
                        className="flex-1 min-w-0 text-left px-3 py-2"
                      >
                        <span
                          className={`block text-sm font-medium truncate ${
                            isActive ? 'text-blue-900 font-semibold' : project.generated ? 'text-slate-700' : 'text-slate-400'
                          }`}
                        >
                          {project.app_name}
                        </span>
                        <span className="block text-xs text-slate-400 truncate">
                          {loadingId === project.project_id
                            ? 'Opening...'
                            : `${TECH_LABEL[project.technology] || project.technology} · ${
                                project.generated ? formatWhen(project.updated_at) : 'not generated'
                              }`}
                        </span>
                      </button>
                      {!project.generated && (
                        <button
                          type="button"
                          onClick={() => handleRetry(project.project_id)}
                          disabled={retryingId === project.project_id}
                          className="shrink-0 mr-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-60 disabled:cursor-not-allowed px-2 py-1 rounded-md hover:bg-blue-100/60 transition-colors"
                        >
                          {retryingId === project.project_id ? 'Retrying...' : 'Retry'}
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
