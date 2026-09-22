import { useEffect, useState } from 'react'
import { getGeminiHealth } from '../api/client'

// Polled once on mount and periodically thereafter so the header's status dot
// stays roughly current without the user having to do anything. 45s split
// down the middle of the requested 30-60s range -- this is a status
// indicator, not something that needs to react within seconds.
const POLL_INTERVAL_MS = 45000

export function useGeminiHealth() {
  // up: null while the first check is still in flight (unknown), then true/false.
  const [health, setHealth] = useState({ up: null, detail: null })

  useEffect(() => {
    let cancelled = false
    const check = () => {
      getGeminiHealth()
        .then((res) => { if (!cancelled) setHealth(res) })
        .catch((err) => { if (!cancelled) setHealth({ up: false, detail: err.message || 'Unreachable' }) })
    }
    check()
    const interval = setInterval(check, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return health
}
