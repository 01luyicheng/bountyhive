import { useEffect, useRef, useState } from 'react'

/**
 * 用 EventSource 监听 /api/demo/logs，返回实时日志数组。
 * 后端推送格式: { run_id, ts, level, msg }
 */
export function useDemoLogs() {
  const [logs, setLogs] = useState([])
  const [connected, setConnected] = useState(false)
  const sourceRef = useRef(null)
  const seenRef = useRef(new Set())

  useEffect(() => {
    let cancelled = false

    const connect = () => {
      try {
        const source = new EventSource('/api/demo/logs')
        sourceRef.current = source

        source.addEventListener('connected', () => {
          if (!cancelled) setConnected(true)
        })

        source.addEventListener('log', (event) => {
          if (cancelled) return
          try {
            const raw = JSON.parse(event.data)
            const entry = {
              run_id: raw.run_id,
              ts: raw.ts,
              msg: raw.msg,
              level: raw.level || 'info',
            }
            if (entry.ts == null || entry.msg == null) return
            const key = `${entry.run_id || ''}|${entry.ts}|${entry.level}|${entry.msg}`
            if (seenRef.current.has(key)) return
            seenRef.current.add(key)
            setLogs((prev) => [...prev, entry].slice(-300))
          } catch {
            // 忽略无法解析的行
          }
        })

        source.addEventListener('error', () => {
          if (cancelled) return
          setConnected(false)
          // EventSource 会自动重连，这里不手动关闭
        })
      } catch {
        setConnected(false)
      }
    }

    connect()

    return () => {
      cancelled = true
      if (sourceRef.current) {
        sourceRef.current.close()
        sourceRef.current = null
      }
    }
  }, [])

  const clear = () => {
    setLogs([])
    seenRef.current.clear()
  }

  return { logs, connected, clear }
}

export default useDemoLogs
