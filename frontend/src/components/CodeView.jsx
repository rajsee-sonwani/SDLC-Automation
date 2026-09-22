import { useState } from 'react'

// Read-only viewer for the actual generated file contents (not react-live's
// flattened runtime script) -- a file list plus the selected file's source.
// Shared by ReactLivePreview and WebContainerPreview's Code view.
export default function CodeView({ files }) {
  const paths = Object.keys(files)
  const [selected, setSelected] = useState(paths[0])
  const activePath = paths.includes(selected) ? selected : paths[0]

  return (
    <div className="flex h-full min-h-0">
      <div className="w-48 shrink-0 overflow-y-auto border-r border-slate-800 bg-slate-900 text-xs py-1">
        {paths.map((path) => (
          <button
            key={path}
            type="button"
            onClick={() => setSelected(path)}
            title={path}
            className={`block w-full text-left px-3 py-1.5 truncate font-mono transition-colors ${
              path === activePath
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {path}
          </button>
        ))}
      </div>
      <pre className="flex-1 min-w-0 overflow-auto p-4 text-xs leading-relaxed text-slate-100 bg-slate-950 whitespace-pre">
        {files[activePath] ?? ''}
      </pre>
    </div>
  )
}
