import { useState } from 'react'
import RequirementInput from './components/RequirementInput.jsx'
import FeedbackPanel from './components/FeedbackPanel.jsx'
import SandpackPreview from './components/SandpackPreview.jsx'
import ReactLivePreview from './components/ReactLivePreview.jsx'

function App() {
  const [project, setProject] = useState(null)

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      <header className="shrink-0 px-4 sm:px-6 py-3 border-b border-slate-200 bg-white">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">AI UI Generator</h1>
        <p className="text-xs text-slate-500">
          Describe a UI, pick a stack, and get a live preview you can refine and download.
        </p>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <aside className="w-full lg:w-[360px] xl:w-[400px] shrink-0 overflow-y-auto border-b lg:border-b-0 lg:border-r border-slate-200 bg-white p-4 sm:p-6 space-y-6">
          <RequirementInput onCreated={setProject} />
          {project && <FeedbackPanel project={project} onUpdated={setProject} />}
        </aside>

        <main className="flex-1 min-w-0 min-h-0 overflow-y-auto p-4 sm:p-6">
          {project ? (
            project.technology === 'react' ? (
              <ReactLivePreview files={project.files} />
            ) : (
              <>
                <SandpackPreview project={project} />
                <p className="mt-2 text-xs text-slate-400">
                  Live preview for Next.js uses a third-party sandboxing service and can occasionally be
                  slow to load or fail. If it does, downloading the .zip and running it locally is a
                  reliable alternative.
                </p>
              </>
            )
          ) : (
            <div className="h-full min-h-[60vh] flex items-center justify-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-2xl">
              Your generated app preview will appear here
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
