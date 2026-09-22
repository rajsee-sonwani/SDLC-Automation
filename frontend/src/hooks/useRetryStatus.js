import { useEffect, useState } from 'react'
import { getRetryStatus } from '../api/client'

// Polls the backend's retry-status endpoint while `active` is true, so a
// component mid-request can show "retrying" instead of a generic spinner
// during the backend's own retry-on-503 window. Simplest version for now:
// polls on a fixed interval rather than being pushed a precise per-request
// status, which is enough to make a retry look intentional rather than stuck.
export function useRetryStatus(active) {
  const [status, setStatus] = useState({ retrying: false, attempt: 0, max_attempts: 5 })

  useEffect(() => {
    if (!active) {
      setStatus({ retrying: false, attempt: 0, max_attempts: 5 })
      return
    }
    let cancelled = false
    const poll = () => {
      getRetryStatus()
        .then((s) => { if (!cancelled) setStatus(s) })
        .catch(() => {})
    }
    poll()
    const interval = setInterval(poll, 1000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [active])

  return status
}
