import { useMemo, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LiveProvider, LiveEditor, LiveError, LivePreview } from 'react-live'

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
function IsolatedPreviewFrame({ children }) {
  const iframeRef = useRef(null)
  const [mountNode, setMountNode] = useState(null)

  useEffect(() => {
    const iframe = iframeRef.current
    const doc = iframe.contentDocument
    doc.open()
    doc.write(
      '<!DOCTYPE html><html><head><meta charset="utf-8"></head>' +
        '<body style="margin:0;min-height:100%"></body></html>'
    )
    doc.close()

    const script = doc.createElement('script')
    script.src = 'https://cdn.tailwindcss.com'
    doc.head.appendChild(script)

    setMountNode(doc.body)
  }, [])

  return (
    <>
      <iframe ref={iframeRef} title="Live preview" className="w-full h-full border-0 block" />
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

export default function ReactLivePreview({ files }) {
  const { code, buildError } = useMemo(() => {
    try {
      return { code: combineFilesForReactLive(files), buildError: null }
    } catch (err) {
      return { code: '', buildError: err.message || String(err) }
    }
  }, [files])

  const scope = { useState, useEffect, useRef, useMemo, useCallback }

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm flex flex-col" style={{ height: 'calc(100vh - 140px)' }}>
      {buildError ? (
        <pre className="flex-1 overflow-auto whitespace-pre-wrap p-4 text-sm text-red-700 bg-red-50">{buildError}</pre>
      ) : (
        <LiveProvider code={code} scope={scope} noInline>
          <div className="flex-1 flex min-h-0">
            <div className="w-[15%] min-w-[160px] overflow-auto bg-slate-900 text-sm">
              <LiveEditor />
            </div>
            {/* overflow-hidden, not overflow-auto: scrolling of the generated app's
                own content now happens inside the iframe's document, not this pane --
                letting this pane scroll too would double-scroll and let the iframe
                grow past its bounds instead of the app's own layout handling it. */}
            <div className="flex-1 min-w-0 overflow-hidden bg-white">
              <IsolatedPreviewFrame>
                <LivePreview />
              </IsolatedPreviewFrame>
            </div>
          </div>
          <LiveError className="shrink-0 overflow-auto max-h-40 whitespace-pre-wrap p-3 text-xs text-red-700 bg-red-50 border-t border-red-200" />
        </LiveProvider>
      )}
    </div>
  )
}
