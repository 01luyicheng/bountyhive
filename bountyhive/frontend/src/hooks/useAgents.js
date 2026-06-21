import { useEffect, useRef, useState } from 'react'

/**
 * 轮询 GET /api/agents，返回 A/B/C 三节点状态。
 * @param {number} interval 轮询间隔，默认 3000ms
 */
export function useAgents(interval = 3000) {
  const [agents, setAgents] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const timerRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      try {
        const res = await fetch('/api/agents')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!cancelled) {
          setAgents(Array.isArray(data?.agents) ? data.agents : [])
          setError(null)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message || 'failed to fetch agents')
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

  return { agents, error, loading }
}

export default useAgents
