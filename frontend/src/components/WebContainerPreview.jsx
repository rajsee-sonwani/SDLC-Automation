import { useEffect, useState } from 'react'
import { WebContainer } from '@webcontainer/api'
import PreviewFallback from './PreviewFallback.jsx'
import ViewToggle from './ViewToggle.jsx'
import CodeView from './CodeView.jsx'
import { getTailwindCdnJs } from '../api/client'

// A page may only boot one WebContainer instance at a time -- calling
// WebContainer.boot() again while one is already booted throws. We keep the
// booted instance -- along with the flat file map it currently reflects, the
// package.json content `npm install` last ran for, and the dev server's
// preview URL once known -- at module scope so remounts, feedback rounds,
// and the pre-warm below all share one running container instead of tearing
// down and re-booting a whole Node runtime + npm install each time.
let containerPromise = null
let mountedFiles = {}
// The package.json content the current/most recently *started* install call
// targets -- set synchronously the moment an install is kicked off (not once
// it finishes), so a second caller arriving while it's still running (e.g.
// the real files showing up before the pre-warm's `npm install` completes)
// awaits the same in-flight install instead of starting a concurrent second
// one against the same node_modules.
let installTargetPackageJson = null
let installPromise = null
let devServerPromise = null
let lastPreviewUrl = null

function getContainer() {
  if (!containerPromise) {
    containerPromise = WebContainer.boot()
  }
  return containerPromise
}

// Converts our flat { "app/page.jsx": "...", "package.json": "..." } shape
// into WebContainer's nested FileSystemTree format.
function toFileSystemTree(files) {
  const tree = {}
  for (const [path, contents] of Object.entries(files)) {
    const parts = path.split('/')
    let node = tree
    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts[i]
      node[dir] = node[dir] || { directory: {} }
      node = node[dir].directory
    }
    node[parts[parts.length - 1]] = { file: { contents } }
  }
  return tree
}

// Fetched once (via our own backend, see app.py's /api/tailwind-cdn) and
// cached for the life of the page, then written into the container as its own
// file (see toWebContainerFiles) rather than referenced via
// `src="https://cdn.tailwindcss.com"`: WebContainers' preview host sends a
// strict `require-corp` COEP on every page it serves (independent of this
// app's own vite.config.js), and that CDN sends neither CORS nor CORP
// headers, so a src-based script tag pointing at it is silently blocked
// inside the WebContainer-hosted page -- confirmed via
// ERR_BLOCKED_BY_RESPONSE in the console, and every Next.js preview rendering
// completely unstyled as a result.
//
// The fix is NOT to inline the script's text directly into layout.jsx: that
// file is JSX *source*, compiled by Next's own build step, and a 400KB blob
// of arbitrary minified JS dropped in as literal `<script>` children is full
// of `{`/`}`/backticks that JSX parses as expression syntax -- confirmed
// empirically, it breaks the build and the preview renders blank. Instead the
// script is written to public/tailwind-cdn.js (served at the site's own
// origin by Next's dev server) and referenced with a plain `src="/..."` --
// same-origin loads are never subject to COEP regardless of policy, and the
// script tag itself stays a short, JSX-safe string.
let tailwindJsPromise = null
function getTailwindJsCached() {
  if (!tailwindJsPromise) {
    tailwindJsPromise = getTailwindCdnJs().catch((err) => {
      tailwindJsPromise = null // let the next mount retry instead of caching a failure forever
      throw err
    })
  }
  return tailwindJsPromise
}

const TAILWIND_SCRIPT_TAG = '<script src="/tailwind-cdn.js"></script>'

function injectTailwindCdn(layoutSource) {
  if (layoutSource.includes('tailwind-cdn.js')) return layoutSource
  if (/<head[ >]/.test(layoutSource)) {
    return layoutSource.replace(/<head([^>]*)>/, `<head$1>\n        ${TAILWIND_SCRIPT_TAG}`)
  }
  return layoutSource.replace(/(<html[^>]*>)/, `$1\n      <head>\n        ${TAILWIND_SCRIPT_TAG}\n      </head>`)
}

// The real project's Tailwind setup needs its own postcss build step, which
// `next dev` would otherwise have to compile from scratch inside the
// container. We only need *some* Tailwind utility classes rendered for a
// live preview, so -- exactly like SandpackPreview and ReactLivePreview
// already do for their previews -- we swap in the Tailwind CDN script and
// drop tailwindcss/postcss/autoprefixer from what gets installed here. This
// never touches the real files sent to the backend, saved to disk, or
// included in the export zip -- only this in-memory copy fed to the
// container.
async function toWebContainerFiles(files) {
  const out = { ...files }
  delete out['postcss.config.js']
  delete out['tailwind.config.js']

  if (out['package.json']) {
    const pkg = JSON.parse(out['package.json'])
    if (pkg.devDependencies) {
      delete pkg.devDependencies.tailwindcss
      delete pkg.devDependencies.postcss
      delete pkg.devDependencies.autoprefixer
      if (Object.keys(pkg.devDependencies).length === 0) delete pkg.devDependencies
    }
    out['package.json'] = JSON.stringify(pkg, null, 2)
  }

  if (out['app/globals.css']) {
    out['app/globals.css'] = out['app/globals.css'].replace(/@tailwind\s+\w+;\s*/g, '')
  }

  if (out['app/layout.jsx']) {
    try {
      out['public/tailwind-cdn.js'] = await getTailwindJsCached()
      out['app/layout.jsx'] = injectTailwindCdn(out['app/layout.jsx'])
    } catch {
      // Best-effort -- if fetching/proxying the script failed, the preview
      // still boots and runs, just unstyled (same as before this existed).
    }
  }

  return out
}

async function writeChangedFiles(instance, files, previousFiles) {
  const dirsEnsured = new Set()
  for (const [path, contents] of Object.entries(files)) {
    if (previousFiles[path] === contents) continue
    const parts = path.split('/')
    if (parts.length > 1) {
      const dir = parts.slice(0, -1).join('/')
      if (!dirsEnsured.has(dir)) {
        await instance.fs.mkdir(dir, { recursive: true })
        dirsEnsured.add(dir)
      }
    }
    await instance.fs.writeFile(path, contents)
  }
}

async function runAndCheck(instance, command, args, onOutput) {
  const process = await instance.spawn(command, args)
  process.output.pipeTo(
    new WritableStream({
      write(chunk) {
        onOutput?.(chunk)
      },
    })
  )
  const exitCode = await process.exit
  if (exitCode !== 0) {
    throw new Error(`"${command} ${args.join(' ')}" exited with code ${exitCode}`)
  }
}

// Mounts/diffs `files` into the container and makes sure `npm install` has
// run for the package.json currently on disk. Shared by the initial mount,
// feedback rounds, and the pre-warm call below, so all three converge on the
// same "what's already there" bookkeeping instead of duplicating it.
async function ensureFilesAndInstall(instance, files, onOutput) {
  if (Object.keys(mountedFiles).length === 0) {
    await instance.mount(toFileSystemTree(files))
  } else {
    await writeChangedFiles(instance, files, mountedFiles)
  }
  mountedFiles = { ...files }

  const packageJson = files['package.json']
  if (packageJson !== installTargetPackageJson) {
    installTargetPackageJson = packageJson
    installPromise = runAndCheck(instance, 'npm', ['install'], onOutput)
  }
  await installPromise
}

// WebContainer's `server-ready` event fires as soon as the dev server's port
// is listening -- but `next dev` compiles each route on first request, so the
// page can still 404/blank for several more seconds after that. We poll the
// server from *inside* the container (loopback, so no cross-origin/CORS
// issue) until it actually returns a real page, so the iframe doesn't get
// revealed onto a blank/404 response. Caps out and proceeds anyway after
// ~30s so a slow-to-compile app doesn't hang the preview forever.
const READY_CHECK_SCRIPT = `
const url = process.argv[2];
(async () => {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      if (res.status === 200 && text.length > 200) process.exit(0);
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  process.exit(1);
})();
`

async function waitForRealResponse(instance, port) {
  const process = await instance.spawn('node', ['-e', READY_CHECK_SCRIPT, `http://localhost:${port}`])
  await process.exit
}

// Starts `npm run dev` at most once per container and resolves once the dev
// server is confirmed to actually be serving real content (see
// waitForRealResponse above). Returns `justStarted: false` on later calls
// (feedback rounds) so callers can skip re-running that readiness gate --
// Next's own fast refresh is already fast enough not to need it.
function ensureDevServerRunning(instance, onOutput) {
  if (devServerPromise) return devServerPromise.then((result) => ({ ...result, justStarted: false }))

  devServerPromise = new Promise((resolve, reject) => {
    instance.on('server-ready', (port, url) => {
      waitForRealResponse(instance, port)
        .catch(() => {}) // best-effort gate; proceed regardless after its own timeout
        .then(() => {
          lastPreviewUrl = url
          resolve({ port, url })
        })
    })
    instance
      .spawn('npm', ['run', 'dev'])
      .then((process) => {
        process.output.pipeTo(new WritableStream({ write: (chunk) => onOutput?.(chunk) }))
        process.exit.then((code) => {
          if (code !== 0) reject(new Error(`"npm run dev" exited with code ${code}`))
        })
      })
      .catch(reject)
  })

  return devServerPromise.then((result) => ({ ...result, justStarted: true }))
}

// Starts booting the container, mounting the (fixed) Next.js scaffold, and
// running `npm install` as soon as the user clicks "Generate" -- rather than
// waiting for the Gemini call to return the actual generated files first.
// `npm install` (~75-90s measured) takes noticeably longer than generation
// (~60s measured), so overlapping them hides most of the generation wait
// instead of paying for both back to back. Safe to call more than once
// (e.g. StrictMode) or when a container is already warm/warming -- it just
// no-ops via the same module-level guards `ensureFilesAndInstall` uses.
//
// NOTE: this package.json must be kept in sync with
// scaffolds/nextjs/package.json (minus the tailwind/postcss/autoprefixer
// devDependencies, which toWebContainerFiles strips anyway) -- if they drift,
// the worst case is a wasted/duplicate install once the real files arrive,
// not a broken preview.
const NEXTJS_PREWARM_FILES = {
  'package.json': JSON.stringify(
    {
      name: 'generated-nextjs-app',
      private: true,
      version: '0.0.1',
      scripts: { dev: 'next dev', build: 'next build', start: 'next start' },
      dependencies: { next: '^14.2.35', react: '^18.3.1', 'react-dom': '^18.3.1' },
    },
    null,
    2
  ),
}

export function prewarmNextjsWebContainer() {
  getContainer()
    .then((instance) => ensureFilesAndInstall(instance, NEXTJS_PREWARM_FILES))
    .catch((err) => {
      // Swallow -- the real WebContainerPreview mount (once files arrive)
      // will retry from scratch and surface any real error to the user.
      console.error('WebContainer pre-warm failed, will retry on mount:', err)
    })
}

export default function WebContainerPreview({ files, projectId }) {
  const [status, setStatus] = useState('booting') // booting | installing | starting | compiling | ready | error
  const [error, setError] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [logTail, setLogTail] = useState('')
  const [showFinishingOverlay, setShowFinishingOverlay] = useState(false)
  const [view, setView] = useState('preview')

  useEffect(() => {
    if (status !== 'ready') return
    // Our readiness check confirms the server returns a real response, but the
    // browser still has to download/parse/hydrate that (unminified, dev-mode)
    // bundle inside the iframe -- something we can't observe from here, since
    // the iframe is cross-origin. Measured around ~10-15s for a small app, so
    // we bridge that gap with a reassuring overlay instead of a blank iframe.
    setShowFinishingOverlay(true)
    const timer = setTimeout(() => setShowFinishingOverlay(false), 9000)
    return () => clearTimeout(timer)
  }, [status])

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        setStatus('booting')
        const instance = await getContainer()
        if (cancelled) return

        const appFiles = await toWebContainerFiles(files)
        if (cancelled) return
        setStatus('installing')
        const onOutput = (chunk) => setLogTail((prev) => (prev + chunk).slice(-4000))
        await ensureFilesAndInstall(instance, appFiles, onOutput)
        if (cancelled) return

        setStatus('starting')
        const { url, justStarted } = await ensureDevServerRunning(instance, onOutput)
        if (cancelled) return

        if (justStarted) {
          setStatus('compiling')
        }
        if (!cancelled) {
          setPreviewUrl(url)
          setStatus('ready')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || String(err))
          setStatus('error')
        }
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [files])

  if (status === 'error') {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
        <PreviewFallback projectId={projectId} />
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 space-y-2">
          <p className="text-sm font-medium text-red-800">The live Next.js preview failed to start.</p>
          <pre className="text-xs text-red-700 whitespace-pre-wrap overflow-auto max-h-40">{error}</pre>
          {logTail && (
            <details className="text-xs text-red-700">
              <summary className="cursor-pointer">Show console output</summary>
              <pre className="whitespace-pre-wrap overflow-auto max-h-60">{logTail}</pre>
            </details>
          )}
        </div>
      </div>
    )
  }

  if (status !== 'ready' || !previewUrl) {
    const message =
      status === 'booting'
        ? 'Starting a Node environment in your browser...'
        : status === 'installing'
        ? 'Setting up a live Node environment, this takes a bit longer than React — installing dependencies (npm install)...'
        : status === 'starting'
        ? 'Starting the Next.js dev server...'
        : 'Almost there — compiling the first page...'
    return (
      <div className="flex-1 min-h-0 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col items-center justify-center gap-3 bg-white text-center px-6">
        <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-700 max-w-sm">{message}</p>
        <p className="text-xs text-slate-400 max-w-sm">
          Next.js previews run a real Node.js server in your browser, so first load is slower than the
          React preview -- this can take a minute or two.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm flex flex-col">
      <div className="shrink-0 flex justify-end px-3 py-2 border-b border-slate-200 bg-white">
        <ViewToggle view={view} onChange={setView} />
      </div>
      {/* Both panes stay mounted and are only hidden via CSS -- unmounting the
          iframe on every toggle would reload the Next.js dev server page (and
          lose any client-side state in the generated app) each time the user
          switches back from Code. */}
      <div className="relative flex-1 min-h-0">
        <div className={`w-full h-full ${view === 'code' ? 'hidden' : ''}`}>
          <iframe title="Next.js live preview" src={previewUrl} className="w-full h-full border-0 block" />
          {showFinishingOverlay && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white text-center px-6">
              <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium text-slate-700 max-w-sm">Finishing up the first render...</p>
            </div>
          )}
        </div>
        <div className={`h-full ${view === 'preview' ? 'hidden' : ''}`}>
          <CodeView files={files} />
        </div>
      </div>
    </div>
  )
}
