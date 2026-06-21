import { useEffect, useRef, useState } from 'react'

/**
 * 轮询 GET /api/demo/status，返回 Demo 进度。
 * @param {number} interval 轮询间隔，默认 1000ms
 */
export function useDemoStatus(interval = 1000) {
  const [status, setStatus] = useState({
    run_id: null,
    phase: 'idle',
    completed_steps: [],
    started_at: null,
    completed_at: null,
  })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const timerRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      try {
        const res = await fetch('/api/demo/status')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!cancelled) {
          setStatus(data || {})
          setError(null)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message || 'failed to fetch demo status')
          setLoading(false)
        }
      }
    }

    poll()
    timerRef.current = setInterval(poll, interval)

    return () => {
      cancelled = true
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [interval])

  return { status, error, loading }
}

export default useDemoStatus
