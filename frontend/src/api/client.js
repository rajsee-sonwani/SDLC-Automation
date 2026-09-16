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

export async function createProject(requirementText, technology) {
  const res = await fetch(`${API_BASE}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requirement_text: requirementText, technology }),
  })
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

export async function getProject(projectId) {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}`)
  return handleResponse(res)
}

export function exportProjectUrl(projectId) {
  return `${API_BASE}/api/projects/${projectId}/export`
}
