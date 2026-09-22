// Small segmented control switching between the live preview and the
// generated code. Shared by ReactLivePreview and WebContainerPreview so both
// stacks present the same control in the same place.
export default function ViewToggle({ view, onChange }) {
  const base = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors'
  const active = 'bg-white text-slate-900 shadow-sm'
  const inactive = 'text-slate-500 hover:text-slate-700'

  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-100 border border-slate-200">
      <button
        type="button"
        onClick={() => onChange('preview')}
        aria-pressed={view === 'preview'}
        className={`${base} ${view === 'preview' ? active : inactive}`}
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
          <path
            d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <circle cx="10" cy="10" r="2.25" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        Preview
      </button>
      <button
        type="button"
        onClick={() => onChange('code')}
        aria-pressed={view === 'code'}
        className={`${base} ${view === 'code' ? active : inactive}`}
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
          <path
            d="M7 6 3 10l4 4M13 6l4 4-4 4"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Code
      </button>
    </div>
  )
}
