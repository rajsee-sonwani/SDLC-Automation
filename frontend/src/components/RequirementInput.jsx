import { useState } from 'react'
import { createProject } from '../api/client'

export default function RequirementInput({ onCreated }) {
  const [requirementText, setRequirementText] = useState('')
  const [technology, setTechnology] = useState('react')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!requirementText.trim() || isSubmitting) return

    setIsSubmitting(true)
    setError(null)
    try {
      const project = await createProject(requirementText, technology)
      onCreated(project)
    } catch (err) {
      setError(err.message || 'Failed to generate the app.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 space-y-4">
      <div>
        <label htmlFor="requirement" className="block text-sm font-semibold text-slate-700 mb-1.5">
          Describe the UI you want
        </label>
        <textarea
          id="requirement"
          value={requirementText}
          onChange={(e) => setRequirementText(e.target.value)}
          rows={6}
          placeholder="e.g. A simple todo list app with a text input, an add button, and a list of todo items each with a checkbox and a delete button."
          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm resize-y"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-between">
        <div className="w-full sm:w-56">
          <label htmlFor="technology" className="block text-sm font-semibold text-slate-700 mb-1.5">
            Technology
          </label>
          <select
            id="technology"
            value={technology}
            onChange={(e) => setTechnology(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
          >
            <option value="react">React (Vite)</option>
            <option value="nextjs">Next.js</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !requirementText.trim()}
          className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm rounded-xl transition-colors shadow-sm shadow-blue-200"
        >
          {isSubmitting ? 'Generating...' : 'Generate App'}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}
    </form>
  )
}
