import { useRef, useState } from 'react'
import { createProject, parseUpload, parseUxReference } from '../api/client'
import { prewarmNextjsWebContainer } from './WebContainerPreview.jsx'
import { useRetryStatus } from '../hooks/useRetryStatus'

const ACCEPTED_EXTENSIONS = ['.yaml', '.yml', '.json', '.txt', '.pdf']
const UX_REFERENCE_ACCEPTED_EXTENSIONS = ['.pdf', '.txt', '.html', '.png', '.jpg', '.jpeg']
const DEFAULT_TECHNOLOGY = 'react'

export default function RequirementInput({ onCreated, onReset }) {
  const [additionalInstructions, setAdditionalInstructions] = useState('')
  const [developerSystemPrompt, setDeveloperSystemPrompt] = useState('')
  const [technology, setTechnology] = useState(DEFAULT_TECHNOLOGY)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const retryStatus = useRetryStatus(isSubmitting)

  // Upload a spec/data-file for structured dataFields extraction (existing
  // feature, unchanged) -- separate from the UX reference upload below.
  const [upload, setUpload] = useState(null) // { filename, kind, text?, dataFields?, warnings }
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const fileInputRef = useRef(null)

  // UX/design reference upload -- replaces the old "Describe the UI you want"
  // textarea as the primary way to specify what to build.
  const [uxReference, setUxReference] = useState(null) // { kind, filename, text?, html?, mime_type?, data_base64? }
  const [isUxUploading, setIsUxUploading] = useState(false)
  const [uxUploadError, setUxUploadError] = useState(null)
  const uxFileInputRef = useRef(null)

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadError(null)
    try {
      const result = await parseUpload(file)
      setUpload({
        filename: result.filename,
        kind: result.kind,
        text: result.text,
        dataFields: result.data_fields,
        warnings: result.warnings || [],
      })
    } catch (err) {
      setUpload(null)
      setUploadError(err.message || 'Failed to process this file.')
    } finally {
      setIsUploading(false)
      // Allow re-selecting the same file after clearing it.
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const clearUpload = () => {
    setUpload(null)
    setUploadError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleUxFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUxUploading(true)
    setUxUploadError(null)
    try {
      const result = await parseUxReference(file)
      setUxReference(result)
    } catch (err) {
      setUxReference(null)
      setUxUploadError(err.message || 'Failed to process this file.')
    } finally {
      setIsUxUploading(false)
      if (uxFileInputRef.current) uxFileInputRef.current.value = ''
    }
  }

  const clearUxReference = () => {
    setUxReference(null)
    setUxUploadError(null)
    if (uxFileInputRef.current) uxFileInputRef.current.value = ''
  }

  const resetForm = () => {
    setAdditionalInstructions('')
    setDeveloperSystemPrompt('')
    setTechnology(DEFAULT_TECHNOLOGY)
    setError(null)
    clearUpload()
    clearUxReference()
    onReset?.()
  }

  const hasAnyInput = uxReference || upload

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!hasAnyInput || isSubmitting) return

    setIsSubmitting(true)
    setError(null)
    // Kick off the WebContainer boot + npm install in parallel with the
    // generation call below -- `npm install` alone measures longer than a
    // typical Gemini call, so overlapping them hides most of the wait
    // instead of paying for both back to back.
    if (technology === 'nextjs') {
      prewarmNextjsWebContainer()
    }
    try {
      const project = await createProject({
        requirementText: '',
        technology,
        additionalInstructions,
        uploadedText: upload?.kind === 'text' ? upload.text : null,
        uploadedFilename: upload?.filename,
        uploadedDataFields: upload?.kind === 'openapi' ? upload.dataFields : null,
        developerSystemPrompt,
        uxReference,
      })
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
        <label htmlFor="upload" className="block text-sm font-semibold text-slate-700 mb-1.5">
          Upload API spec for data fields <span className="font-normal text-slate-400">(optional)</span>
        </label>
        {upload ? (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm">
            <div className="min-w-0">
              <p className="text-slate-800 font-medium truncate">{upload.filename}</p>
              <p className="text-xs text-slate-500">
                {upload.kind === 'openapi'
                  ? `${upload.dataFields.length} data field${upload.dataFields.length === 1 ? '' : 's'} extracted`
                  : `${upload.text.length.toLocaleString()} characters extracted`}
              </p>
              {upload.warnings.length > 0 && (
                <p className="text-xs text-amber-600 mt-0.5">{upload.warnings.join(' ')}</p>
              )}
            </div>
            <button
              type="button"
              onClick={clearUpload}
              className="shrink-0 text-xs font-medium text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Remove
            </button>
          </div>
        ) : (
          <input
            id="upload"
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(',')}
            onChange={handleFileChange}
            disabled={isUploading}
            className="w-full text-sm text-slate-600 file:mr-3 file:px-4 file:py-2 file:rounded-xl file:border-0 file:bg-blue-50 file:text-blue-700 file:text-sm file:font-medium hover:file:bg-blue-100 file:cursor-pointer disabled:opacity-60"
          />
        )}
        <p className="text-xs text-slate-400 mt-1">
          OpenAPI/Swagger (.yaml, .json) for structured data fields, or plain text (.txt) / PDF folded
          into the description below.
        </p>
        {isUploading && <p className="text-xs text-slate-500 mt-1">Processing file...</p>}
        {uploadError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-2">{uploadError}</p>
        )}
      </div>

      <div>
        <label htmlFor="ux-reference" className="block text-sm font-semibold text-slate-700 mb-1.5">
          Upload UX/design reference
        </label>
        {uxReference ? (
          <div className="flex items-start justify-between gap-3 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm">
            <div className="min-w-0 flex items-center gap-3">
              {uxReference.kind === 'image' && (
                <img
                  src={`data:${uxReference.mime_type};base64,${uxReference.data_base64}`}
                  alt=""
                  className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                />
              )}
              <div className="min-w-0">
                <p className="text-slate-800 font-medium truncate">{uxReference.filename}</p>
                <p className="text-xs text-slate-500">
                  {uxReference.kind === 'image'
                    ? 'Image attached — used as real visual reference'
                    : uxReference.kind === 'html'
                    ? `${uxReference.html.length.toLocaleString()} characters of HTML markup — adapted directly, not just summarized`
                    : `${uxReference.text.length.toLocaleString()} characters extracted`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={clearUxReference}
              className="shrink-0 text-xs font-medium text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Remove
            </button>
          </div>
        ) : (
          <input
            id="ux-reference"
            ref={uxFileInputRef}
            type="file"
            accept={UX_REFERENCE_ACCEPTED_EXTENSIONS.join(',')}
            onChange={handleUxFileChange}
            disabled={isUxUploading}
            className="w-full text-sm text-slate-600 file:mr-3 file:px-4 file:py-2 file:rounded-xl file:border-0 file:bg-blue-50 file:text-blue-700 file:text-sm file:font-medium hover:file:bg-blue-100 file:cursor-pointer disabled:opacity-60"
          />
        )}
        <p className="text-xs text-slate-400 mt-1">
          PDF, plain text (.txt), image (.png/.jpg), or HTML — describes or shows the UI to build.
          An HTML file is treated as real markup to adapt structure and style from directly.
        </p>
        {isUxUploading && <p className="text-xs text-slate-500 mt-1">Processing file...</p>}
        {uxUploadError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-2">{uxUploadError}</p>
        )}
      </div>

      <div>
        <label htmlFor="additional-instructions" className="block text-sm font-semibold text-slate-700 mb-1.5">
          Additional instructions <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          id="additional-instructions"
          value={additionalInstructions}
          onChange={(e) => setAdditionalInstructions(e.target.value)}
          rows={3}
          placeholder="e.g. Use a strictly monochrome palette. Avoid modals -- use inline panels instead."
          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm resize-y"
        />
      </div>

      {/* Developer-facing, deliberately not part of the main user-facing flow above --
          collapsed by default, and separate from "Additional instructions": that field is
          end-user data about the UI to build, this is a system-prompt-level addition for
          whoever is running this tool. Scoped to this one project only. */}
      <details className="rounded-xl border border-slate-200 open:bg-slate-50">
        <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-semibold text-slate-600">
          Developer settings (advanced)
        </summary>
        <div className="px-4 pb-4 pt-1">
          <label htmlFor="developer-system-prompt" className="block text-xs text-slate-500 mb-1.5">
            Custom system prompt addition — appended to the end of this tool's default system
            prompts for this project only (requirement parsing, change planning, and file
            generation). It never replaces them.
          </label>
          <textarea
            id="developer-system-prompt"
            value={developerSystemPrompt}
            onChange={(e) => setDeveloperSystemPrompt(e.target.value)}
            rows={3}
            placeholder="e.g. Prefer function declarations over arrow functions for components."
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm resize-y font-mono"
          />
        </div>
      </details>

      <div className="flex flex-wrap gap-3 items-end justify-between">
        <div className="min-w-0 flex-1 sm:flex-none sm:w-56">
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

        <div className="flex flex-wrap gap-2 min-w-0 w-full sm:w-auto">
          <button
            type="button"
            onClick={resetForm}
            className="min-w-0 shrink-0 px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium text-sm rounded-xl transition-colors whitespace-nowrap"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !hasAnyInput}
            className="min-w-0 flex-1 sm:flex-none px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm rounded-xl transition-colors shadow-sm shadow-blue-200 whitespace-nowrap"
          >
            {isSubmitting ? 'Generating...' : 'Generate App'}
          </button>
        </div>
      </div>

      {isSubmitting && retryStatus.retrying && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          Having trouble reaching the AI model, retrying... (attempt {retryStatus.attempt} of{' '}
          {retryStatus.max_attempts})
        </p>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 space-y-1">
          <p className="font-medium">
            Nothing was generated — no project was created, so there's nothing to preview or download
            yet. Try again in a moment.
          </p>
          <details className="text-xs">
            <summary className="cursor-pointer">Show error detail</summary>
            <p className="mt-1">{error}</p>
          </details>
        </div>
      )}
    </form>
  )
}
