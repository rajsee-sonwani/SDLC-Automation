import { useEffect, useState } from 'react'
import RequirementInput from './components/RequirementInput.jsx'
import FeedbackPanel from './components/FeedbackPanel.jsx'
import ReactLivePreview from './components/ReactLivePreview.jsx'
import WebContainerPreview from './components/WebContainerPreview.jsx'
import GeminiHealthIndicator from './components/GeminiHealthIndicator.jsx'
import ProjectSidebar from './components/ProjectSidebar.jsx'
import PanelToggleIcon from './components/PanelToggleIcon.jsx'
import { getProject } from './api/client'

const ACTIVE_PROJECT_KEY = 'aiUiGenerator.activeProjectId'

function App() {
  const [project, setProject] = useState(null)
  // Independent of the sidebar's own collapse state (see ProjectSidebar.jsx)
  // -- either can be toggled in any order. Always starts expanded, same as
  // the sidebar, and not persisted across reloads.
  const [formCollapsed, setFormCollapsed] = useState(false)

  // Written here rather than in an effect on `project`: an effect would fire
  // once with the initial null and clear the stored id before the restore
  // below had a chance to use it.
  const openProject = (next) => {
    setProject(next)
    if (next) localStorage.setItem(ACTIVE_PROJECT_KEY, next.project_id)
    else localStorage.removeItem(ACTIVE_PROJECT_KEY)
  }

  // Reopen whatever project was active before a page reload.
  useEffect(() => {
    const savedId = localStorage.getItem(ACTIVE_PROJECT_KEY)
    if (!savedId) return
    getProject(savedId)
      .then(setProject)
      .catch(() => localStorage.removeItem(ACTIVE_PROJECT_KEY))
  }, [])

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      <header className="shrink-0 px-4 sm:px-6 py-3 border-b border-slate-200 bg-white flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">AI UI Generator</h1>
          <p className="text-xs text-slate-500 truncate">
            Describe a UI, pick a stack, and get a live preview you can refine and download.
          </p>
        </div>
        <GeminiHealthIndicator />
      </header>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <ProjectSidebar activeProjectId={project?.project_id ?? null} onSelect={openProject} />

        <div className="shrink-0 flex border-b lg:border-b-0 lg:border-r border-slate-200 bg-white">
          {/* Always visible regardless of collapsed state, independent of the
              sidebar's own toggle -- either panel can be collapsed in any order. */}
          <button
            type="button"
            onClick={() => setFormCollapsed((c) => !c)}
            title={formCollapsed ? 'Show form panel' : 'Hide form panel'}
            aria-label={formCollapsed ? 'Show form panel' : 'Hide form panel'}
            aria-expanded={!formCollapsed}
            className="shrink-0 w-6 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <PanelToggleIcon />
          </button>

          {/* Slides fully out of view (width -> 0) rather than unmounting, so
              in-progress form state (typed instructions, uploaded files) isn't
              lost by collapsing -- same pattern as ProjectSidebar's own collapse. */}
          <div
            className={`overflow-hidden transition-all duration-200 ease-in-out ${
              formCollapsed ? 'w-0 opacity-0' : 'w-full lg:w-[360px] xl:w-[400px] opacity-100'
            }`}
          >
            <aside className="w-full lg:w-[360px] xl:w-[400px] h-full overflow-y-auto p-4 sm:p-6 space-y-6">
              <RequirementInput onCreated={openProject} onReset={() => openProject(null)} />
              {project && <FeedbackPanel project={project} onUpdated={openProject} />}
            </aside>
          </div>
        </div>

        <main className="flex-1 min-w-0 min-h-0 p-4 sm:p-6 flex flex-col">
          {project ? (
            project.technology === 'react' ? (
              <ReactLivePreview files={project.files} projectId={project.project_id} />
            ) : (
              <WebContainerPreview files={project.files} projectId={project.project_id} />
            )
          ) : (
            <div className="flex-1 min-h-0 flex items-center justify-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-2xl">
              Your generated app preview will appear here
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
