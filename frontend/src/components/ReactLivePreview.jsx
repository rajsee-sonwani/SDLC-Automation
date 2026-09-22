import { useMemo, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LiveProvider, LiveError, LivePreview, LiveContext } from 'react-live'
import PreviewFallback from './PreviewFallback.jsx'
import ViewToggle from './ViewToggle.jsx'
import CodeView from './CodeView.jsx'

// react-live's <LiveError> renders null when there's no error, so there's no
// prop telling a parent "an error is currently showing" -- read it directly
// off LiveContext instead, to decide whether to render this block (raw error
// detail + the zip-download fallback) at all.
function RuntimeErrorPanel({ projectId }) {
  const { error } = useContext(LiveContext)
  if (!error) return null
  return (
    <div className="shrink-0 border-t border-red-200">
      <LiveError className="overflow-auto max-h-40 whitespace-pre-wrap p-3 text-xs text-red-700 bg-red-50" />
      <div className="p-3 pt-0">
        <PreviewFallback projectId={projectId} />
      </div>
    </div>
  )
}

const ENTRY_FILE = 'src/App.jsx'

// react-live's LivePreview renders straight into our own document, sharing our
// own compiled Tailwind stylesheet -- which only contains utility classes found
// in THIS tool's own source files (see tailwind.config.js `content`), never the
// classes inside generated code fetched at runtime. So generated apps render
// fully unstyled (giant default-size <svg> icons, no flex/spacing/etc) unless we
// give them their own Tailwind. Loading the Tailwind Play CDN script directly in
// this document would style our own tool's UI too, so instead we mount
// LivePreview inside an isolated <iframe> (via a portal into its contentDocument)
// and load the CDN script only inside that iframe's document.
// Declared via srcDoc rather than written in with doc.open()/doc.write() after
// mount: writing into a freshly-created iframe races the browser's commit of
// its initial about:blank document, which can discard the written document --
// including the Tailwind script -- leaving the generated app rendered
// completely unstyled. That race is timing-dependent (and StrictMode's
// double-invoked effects made it likelier), so it showed up as a preview that
// was correctly styled on one load and all-default-styles on the next.
const PREVIEW_DOCUMENT = `<!DOCTYPE html><html><head><meta charset="utf-8">
<script src="https://cdn.tailwindcss.com"><\/script>
</head><body style="margin:0;min-height:100%"></body></html>`

function IsolatedPreviewFrame({ children }) {
  const [mountNode, setMountNode] = useState(null)

  return (
    <>
      <iframe
        title="Live preview"
        srcDoc={PREVIEW_DOCUMENT}
        onLoad={(e) => setMountNode(e.currentTarget.contentDocument.body)}
        className="w-full h-full border-0 block"
      />
      {mountNode && createPortal(children, mountNode)}
    </>
  )
}

// react-live evaluates one flat script, not a multi-file project -- it has no module
// resolver of its own. So before handing code to LiveProvider we walk the generated
// files from the entry, inline every local `./components/...` import it (transitively)
// depends on as sibling declarations in one script, strip all import statements (npm
// package imports like `react` are supplied via `scope` instead), and strip each
// component's `export default` so the identifiers are just plain declarations that can
// reference one another directly.

function resolveLocalImportPath(files, fromPath, specifier) {
  const fromDir = fromPath.split('/').slice(0, -1)
  const stack = [...fromDir]
  for (const segment of specifier.split('/')) {
    if (segment === '.' || segment === '') continue
    if (segment === '..') stack.pop()
    else stack.push(segment)
  }
  const base = stack.join('/')
  for (const ext of ['', '.jsx', '.js']) {
    if (files[base + ext] !== undefined) return base + ext
  }
  return null
}

function stripImports(code) {
  // Anchored on the `from '...'` clause rather than a terminating semicolon --
  // this codebase's generated code (see scaffolds/react-vite/src/main.jsx) doesn't
  // use semicolons, so a semicolon-anchored match would silently fail to match
  // anything, leaving `import` statements in place to crash at eval time with
  // "require is not defined". Handles both single- and multi-line (named-import
  // list) forms, plus bare side-effect imports as a fallback.
  return code
    .replace(/^[ \t]*import\s[\s\S]*?\sfrom\s+['"][^'"]*['"];?[ \t]*\n?/gm, '')
    .replace(/^[ \t]*import\s+['"][^'"]*['"];?[ \t]*\n?/gm, '')
}

function extractDefaultExport(code) {
  // Trailing form: `const Foo = () => {...}` / `function Foo() {...}` declared earlier,
  // then `export default Foo;` on its own line -- just drop that line.
  const trailingMatch = code.match(/^[ \t]*export default\s+([A-Za-z_$][\w$]*)\s*;?[ \t]*$/m)
  if (trailingMatch) {
    return { code: code.replace(trailingMatch[0], '').trim(), name: trailingMatch[1] }
  }
  // Inline function form: `export default function Foo() {...}` (or anonymous).
  const fnMatch = code.match(/export default\s+function\s*([A-Za-z_$][\w$]*)?\s*\(/)
  if (fnMatch) {
    let name = fnMatch[1]
    let out = code.replace('export default ', '')
    if (!name) {
      name = '__DefaultComponent__'
      out = out.replace(/^function\s*\(/, `function ${name}(`)
    }
    return { code: out, name }
  }
  // Inline class form: `export default class Foo extends ... {...}` (or anonymous).
  const classMatch = code.match(/export default\s+class\s*([A-Za-z_$][\w$]*)?/)
  if (classMatch) {
    let name = classMatch[1]
    let out = code.replace('export default ', '')
    if (!name) {
      name = '__DefaultComponent__'
      out = out.replace(/^class(?=[\s{])/, `class ${name}`)
    }
    return { code: out, name }
  }
  return { code, name: null }
}

const LOCAL_IMPORT_RE = /import\s+([A-Za-z_$][\w$]*)\s+from\s+['"](\.[^'"]+)['"]/g

export function combineFilesForReactLive(files) {
  if (files[ENTRY_FILE] === undefined) {
    throw new Error(`No ${ENTRY_FILE} found among the generated files.`)
  }

  const visited = new Set()
  const blocks = []

  function visit(path) {
    if (visited.has(path)) return
    visited.add(path)
    const raw = files[path]
    if (raw == null) return

    const aliasLines = []
    LOCAL_IMPORT_RE.lastIndex = 0
    let match
    while ((match = LOCAL_IMPORT_RE.exec(raw))) {
      const [, localName, specifier] = match
      const resolved = resolveLocalImportPath(files, path, specifier)
      if (!resolved) continue
      visit(resolved)
      const { name: exportedName } = extractDefaultExport(files[resolved])
      if (exportedName && exportedName !== localName) {
        aliasLines.push(`const ${localName} = ${exportedName};`)
      }
    }

    const { code, name } = extractDefaultExport(stripImports(raw))
    blocks.push([code, ...aliasLines].join('\n'))
    if (path === ENTRY_FILE) blocks.entryName = name
  }

  visit(ENTRY_FILE)

  const entryName = blocks.entryName || 'App'
  return `${blocks.join('\n\n')}\n\nrender(<${entryName} />);`
}

export default function ReactLivePreview({ files, projectId }) {
  const [view, setView] = useState('preview')
  const { code, buildError } = useMemo(() => {
    try {
      return { code: combineFilesForReactLive(files), buildError: null }
    } catch (err) {
      return { code: '', buildError: err.message || String(err) }
    }
  }, [files])

  const scope = { useState, useEffect, useRef, useMemo, useCallback }

  return (
    <div className="flex-1 min-h-0 rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm flex flex-col">
      {buildError ? (
        <div className="flex-1 overflow-auto p-4 space-y-3">
          <PreviewFallback projectId={projectId} />
          <details className="text-xs text-red-700">
            <summary className="cursor-pointer">Show error detail</summary>
            <pre className="whitespace-pre-wrap mt-2">{buildError}</pre>
          </details>
        </div>
      ) : (
        <LiveProvider code={code} scope={scope} noInline>
          <div className="shrink-0 flex justify-end px-3 py-2 border-b border-slate-200 bg-white">
            <ViewToggle view={view} onChange={setView} />
          </div>
          <div className="flex-1 flex min-h-0">
            {/* Both panes stay mounted at all times and are only hidden via CSS --
                conditionally unmounting the preview pane would tear down and
                recreate the iframe (see IsolatedPreviewFrame) every time the user
                switches back from Code, resetting any state inside the generated
                app. overflow-hidden, not overflow-auto, on the preview pane:
                scrolling of the generated app's own content happens inside the
                iframe's document, not this pane -- letting this pane scroll too
                would double-scroll and let the iframe grow past its bounds instead
                of the app's own layout handling it. */}
            <div className={`flex-1 min-w-0 overflow-hidden bg-white ${view === 'code' ? 'hidden' : ''}`}>
              <IsolatedPreviewFrame>
                <LivePreview />
              </IsolatedPreviewFrame>
            </div>
            <div className={`flex-1 min-w-0 min-h-0 ${view === 'preview' ? 'hidden' : ''}`}>
              <CodeView files={files} />
            </div>
          </div>
          <RuntimeErrorPanel projectId={projectId} />
        </LiveProvider>
      )}
    </div>
  )
}
