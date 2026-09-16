import { useState } from 'react'
import { getProject, submitFeedback, exportProjectUrl } from '../api/client'

export default function FeedbackPanel({ project, onUpdated }) {
  const [feedbackText, setFeedbackText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [changelog, setChangelog] = useState([])

  const { requirement } = project
  const ambiguities = requirement.ambiguities || []
  const unmappedRequests = requirement.unmappedRequests || []

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault()
    if (!feedbackText.trim() || isSubmitting) return

    setIsSubmitting(true)
    setError(null)
    try {
      const result = await submitFeedback(project.project_id, feedbackText)
      const refreshed = await getProject(project.project_id)
      onUpdated(refreshed)
      setChangelog((prev) => [...prev, result])
      setFeedbackText('')
    } catch (err) {
      setError(err.message || 'Failed to apply feedback.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-700 truncate">{requirement.appName}</h2>
        <a
          href={exportProjectUrl(project.project_id)}
          className="shrink-0 text-sm font-medium text-blue-600 hover:text-blue-700 px-4 py-2 rounded-xl border border-blue-200 hover:bg-blue-50 transition-colors"
        >
          Download .zip
        </a>
      </div>

      {(ambiguities.length > 0 || unmappedRequests.length > 0) && (
        <div className="space-y-4">
          {ambiguities.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-amber-800 mb-2">Here's what I assumed</h3>
              <ul className="space-y-2">
                {ambiguities.map((a, i) => (
                  <li key={i} className="text-sm text-amber-900">
                    <span className="font-medium">"{a.phrase}"</span> → {a.assumption}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {unmappedRequests.length > 0 && (
            <div className="bg-slate-100 border border-slate-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Here's what I couldn't support yet</h3>
              <ul className="space-y-2">
                {unmappedRequests.map((u, i) => (
                  <li key={i} className="text-sm text-slate-700">
                    <span className="font-medium">"{u.phrase}"</span> — {u.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleFeedbackSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 space-y-3">
        <label htmlFor="feedback" className="block text-sm font-semibold text-slate-700">
          Refine this app
        </label>
        <textarea
          id="feedback"
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          rows={3}
          placeholder="e.g. Make the submit button green and add a loading spinner while it submits."
          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm resize-y"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || !feedbackText.trim()}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm rounded-xl transition-colors shadow-sm shadow-blue-200"
          >
            {isSubmitting ? 'Applying...' : 'Submit Feedback'}
          </button>
        </div>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
        )}
      </form>

      {changelog.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Changelog</h3>
          <ol className="space-y-3">
            {changelog.map((entry, i) => (
              <li key={i} className="text-sm border-l-2 border-blue-200 pl-3">
                <p className="text-slate-700">{entry.reasoning}</p>
                {entry.changed_files.length > 0 && (
                  <p className="text-xs text-slate-400 mt-1">{entry.changed_files.join(', ')}</p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
