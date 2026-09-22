import { useGeminiHealth } from '../hooks/useGeminiHealth'

// Small, unobtrusive status dot for the header -- reflects the real
// /api/gemini/health response, polled by useGeminiHealth.
export default function GeminiHealthIndicator() {
  const { up, detail } = useGeminiHealth()

  const label = up === null ? 'Gemini: checking...' : up ? 'Gemini: available' : 'Gemini: unavailable'
  const dotColor = up === null ? 'bg-slate-300' : up ? 'bg-green-500' : 'bg-red-500'
  const textColor = up === null ? 'text-slate-400' : up ? 'text-green-700' : 'text-red-700'

  return (
    <div
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${textColor}`}
      title={up === false && detail ? detail : undefined}
    >
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} />
      {label}
    </div>
  )
}
