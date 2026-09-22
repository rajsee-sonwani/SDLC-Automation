import { exportProjectUrl } from '../api/client'

// Shown when a project's files WERE generated successfully but the live
// preview mechanism itself fails to render (React Live threw, or
// WebContainers failed to boot/install/run). Distinct from a generation
// failure (see RequirementInput.jsx's error state) -- here the code exists
// and is downloadable, so this always includes a working zip link.
export default function PreviewFallback({ projectId }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between gap-4 flex-wrap">
      <p className="text-sm text-slate-700">
        Live preview isn't available right now — you can still download the generated project as a
        zip and run it locally.
      </p>
      <a
        href={exportProjectUrl(projectId)}
        className="shrink-0 text-sm font-medium text-blue-600 hover:text-blue-700 px-4 py-2 rounded-xl border border-blue-200 hover:bg-blue-50 transition-colors bg-white"
      >
        Download .zip
      </a>
    </div>
  )
}
