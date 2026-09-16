import { useMemo } from 'react'
import { Sandpack } from '@codesandbox/sandpack-react'

const TAILWIND_CDN_TAG = '<script src="https://cdn.tailwindcss.com"></script>'

// Sandpack's bundler doesn't reliably run a project's own PostCSS/Tailwind
// build step, so the preview gets the Tailwind CDN script injected into its
// copy of index.html only -- this never touches the real files sent to the
// backend or included in the export zip.
function toSandpackFiles(files) {
  const sandpackFiles = {}
  for (const [path, content] of Object.entries(files)) {
    sandpackFiles['/' + path] = { code: content }
  }
  if (sandpackFiles['/index.html']) {
    sandpackFiles['/index.html'] = {
      code: sandpackFiles['/index.html'].code.replace(
        '</head>',
        `    ${TAILWIND_CDN_TAG}\n  </head>`
      ),
    }
  }
  return sandpackFiles
}

export default function SandpackPreview({ project }) {
  const { files, technology } = project
  const sandpackFiles = useMemo(() => toSandpackFiles(files), [files])
  const sandpackTemplate = technology === 'nextjs' ? 'nextjs' : 'vite-react'

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm">
      <Sandpack
        template={sandpackTemplate}
        files={sandpackFiles}
        // Sandpack's built-in "vite-react" template ships its own default
        // /App.jsx + /index.jsx and bundles from `main: "/App.jsx"` -- our
        // generated files live under /src/... and never overwrite those
        // paths, so without this override Sandpack silently renders its own
        // placeholder ("Hello world") instead of our files. customSetup.entry
        // takes precedence over the template's `main` (confirmed in
        // @codesandbox/sandpack-react's getSandpackStateFromProps).
        customSetup={technology === 'nextjs' ? undefined : { entry: '/src/main.jsx' }}
        options={{
          showConsole: false,
          showTabs: true,
          // The preview is meant to be the dominant element on the page, so
          // give the code editor a thin sliver and let the preview pane take
          // the rest (~85%). Sandpack applies `editorHeight` as an inline
          // style directly on the editor/preview panes rather than through
          // CSS inheritance, so a viewport-relative calc() here is reliable
          // where a plain percentage wouldn't be.
          editorWidthPercentage: 15,
          editorHeight: 'calc(100vh - 140px)',
        }}
        theme="light"
      />
    </div>
  )
}
