import { useEffect, useRef, useState } from 'react'

/**
 * 轮询 GET /api/capsules?outcome=failed，返回失败 Capsule 列表。
 * @param {number} interval 轮询间隔，默认 3000ms
 */
export function useCapsules(interval = 3000) {
  const [capsules, setCapsules] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const timerRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      try {
        const res = await fetch('/api/capsules?outcome=failed')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!cancelled) {
          setCapsules(Array.isArray(data?.capsules) ? data.capsules : [])
          setError(null)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message || 'failed to fetch capsules')
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

  return { capsules, error, loading }
}

export default useCapsules
