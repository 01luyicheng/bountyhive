import { useEffect, useRef, useState } from 'react'

/**
 * 轮询 GET /api/bounties，返回悬赏市场列表。
 * @param {number} interval 轮询间隔，默认 3000ms
 */
export function useBounties(interval = 3000) {
  const [bounties, setBounties] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const timerRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      try {
        const res = await fetch('/api/bounties')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!cancelled) {
          setBounties(Array.isArray(data?.bounties) ? data.bounties : [])
          setError(null)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message || 'failed to fetch bounties')
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

  return { bounties, error, loading }
}

export default useBounties
