const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

async function handleResponse(res) {
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail || detail
    } catch {
      // response wasn't JSON, fall back to statusText
    }
    throw new Error(detail)
  }
  return res.json()
}

export async function parseUpload(file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_BASE}/api/uploads/parse`, {
    method: 'POST',
    body: formData,
  })
  return handleResponse(res)
}

// Separate from parseUpload above -- that one's for the OpenAPI/data-field
// upload; this is for the UX/design-reference upload (see RequirementInput.jsx).
export async function parseUxReference(file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_BASE}/api/uploads/ux-reference`, {
    method: 'POST',
    body: formData,
  })
  return handleResponse(res)
}

export async function createProject({
  requirementText,
  technology,
  additionalInstructions,
  uploadedText,
  uploadedFilename,
  uploadedDataFields,
  developerSystemPrompt,
  uxReference,
}) {
  const res = await fetch(`${API_BASE}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requirement_text: requirementText,
      technology,
      additional_instructions: additionalInstructions || null,
      uploaded_text: uploadedText || null,
      uploaded_filename: uploadedFilename || null,
      uploaded_data_fields: uploadedDataFields || null,
      developer_system_prompt: developerSystemPrompt || null,
      // uxReference already mirrors the backend's UxReference shape (kind,
      // filename, text/html/mime_type/data_base64) -- passed straight through
      // from parseUxReference's response, see RequirementInput.jsx.
      ux_reference: uxReference || null,
    }),
  })
  return handleResponse(res)
}

export async function approveProject(projectId) {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/approve`, { method: 'POST' })
  return handleResponse(res)
}

export async function retryProject(projectId) {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/retry`, { method: 'POST' })
  return handleResponse(res)
}

export async function submitFeedback(projectId, feedbackText) {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feedback_text: feedbackText }),
  })
  return handleResponse(res)
}

export async function listProjects() {
  const res = await fetch(`${API_BASE}/api/projects`)
  return handleResponse(res)
}

export async function getProject(projectId) {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}`)
  return handleResponse(res)
}

export function exportProjectUrl(projectId) {
  return `${API_BASE}/api/projects/${projectId}/export`
}

export async function getRetryStatus() {
  const res = await fetch(`${API_BASE}/api/gemini/retry-status`)
  return handleResponse(res)
}

export async function getGeminiHealth() {
  const res = await fetch(`${API_BASE}/api/gemini/health`)
  return handleResponse(res)
}

export async function getTailwindCdnJs() {
  const res = await fetch(`${API_BASE}/api/tailwind-cdn`)
  if (!res.ok) throw new Error(`Failed to load the Tailwind CDN script (HTTP ${res.status})`)
  return res.text()
}
