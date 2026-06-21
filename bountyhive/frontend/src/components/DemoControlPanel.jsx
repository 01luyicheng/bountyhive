import React, { useEffect, useRef, useState } from 'react'
import { useDemoStatus } from '../hooks/useDemoStatus'
import { useDemoLogs } from '../hooks/useDemoLogs'

const PHASE_META = {
  idle: { label: 'IDLE', color: 'ink-muted', tag: 'tag-dim' },
  running: { label: 'RUNNING', color: 'neon-cyan', tag: 'tag-cyan' },
  done: { label: 'DONE', color: 'neon-green', tag: 'tag-green' },
  error: { label: 'ERROR', color: 'neon-red', tag: 'tag-red' },
}

const AGENT_COLOR = {
  A: 'text-neon-magenta',
  B: 'text-neon-cyan',
  C: 'text-neon-violet',
  system: 'text-ink-muted',
}

function formatTime(ts) {
  if (!ts) return '—'
  try {
    const d = typeof ts === 'number' ? new Date(ts) : new Date(ts)
    if (isNaN(d.getTime())) return String(ts)
    return d.toLocaleTimeString('zh-CN', { hour12: false })
  } catch {
    return String(ts)
  }
}

function formatLogTime(ts) {
  if (!ts) return '--:--:--'
  try {
    const d = typeof ts === 'number' ? new Date(ts) : new Date(ts)
    if (isNaN(d.getTime())) return '--:--:--'
    return d.toLocaleTimeString('zh-CN', { hour12: false })
  } catch {
    return '--:--:--'
  }
}

/**
 * Demo 控制面板：启动按钮 + 状态 + 实时日志（SSE）。
 */
export default function DemoControlPanel() {
  const { status, error: statusError } = useDemoStatus()
  const { logs, connected, clear: clearLogs } = useDemoLogs()
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState(null)
  const logEndRef = useRef(null)

  const phase = status?.phase || 'idle'
  const phaseMeta = PHASE_META[phase] || PHASE_META.idle
  const isRunning = phase === 'running'

  // 自动滚动到底部
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [logs])

  const handleStart = async () => {
    setStarting(true)
    setStartError(null)
    clearLogs()
    try {
      const res = await fetch('/api/demo/start', { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch (e) {
      setStartError(e.message || 'failed to start demo')
    } finally {
      setStarting(false)
    }
  }

  const handleReset = async () => {
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' })
      clearLogs()
      setStartError(null)
      if (!res.ok) {
        setStartError('重置请求已发送')
      }
    } catch {
      setStartError('重置请求已发送')
      clearLogs()
    }
  }

  const completedSteps = status?.completed_steps || []
  const elapsed = status?.started_at
    ? Math.round(((status?.completed_at ? new Date(status.completed_at).getTime() : Date.now()) - new Date(status.started_at).getTime()) / 1000)
    : 0

  return (
    <section className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-3">
          <span className="panel-title">// 01 · Demo 控制台</span>
          <span className={`tag ${phaseMeta.tag} ${isRunning ? 'animate-pulse' : ''}`}>
            {phaseMeta.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-mono ${connected ? 'text-neon-green' : 'text-ink-dim'}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${connected ? 'bg-neon-green animate-heartbeat' : 'bg-ink-dim'}`} />
            SSE {connected ? 'live' : '...'}
          </span>
        </div>
      </div>

      <div className="panel-body space-y-3">
        {/* 控制按钮 + 状态摘要 */}
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-3">
          <div className="space-y-2">
            <button
              onClick={handleStart}
              disabled={starting || isRunning}
              className="btn-primary w-full"
            >
              {starting ? '◉ 启动中...' : isRunning ? '◉ 运行中' : '▶ 启动 Demo'}
            </button>
            <button
              onClick={handleReset}
              disabled={isRunning}
              className="btn-ghost w-full"
            >
              ↻ 重置
            </button>
            {startError && (
              <div className="text-[10px] font-mono text-neon-red/80 break-all">
                ⚠ {startError}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="panel bg-void-deep/60 p-2.5">
              <div className="text-[9px] font-mono uppercase tracking-wider text-ink-dim">phase</div>
              <div className={`font-display text-sm font-bold text-${phaseMeta.color} text-glow-cyan`}>
                {phaseMeta.label}
              </div>
            </div>
            <div className="panel bg-void-deep/60 p-2.5">
              <div className="text-[9px] font-mono uppercase tracking-wider text-ink-dim">elapsed</div>
              <div className="font-display text-sm font-bold text-neon-amber">
                {elapsed}s
              </div>
            </div>
            <div className="panel bg-void-deep/60 p-2.5">
              <div className="text-[9px] font-mono uppercase tracking-wider text-ink-dim">steps</div>
              <div className="font-display text-sm font-bold text-neon-cyan">
                {completedSteps.length}
              </div>
            </div>
            <div className="panel bg-void-deep/60 p-2.5">
              <div className="text-[9px] font-mono uppercase tracking-wider text-ink-dim">run_id</div>
              <div className="font-mono text-[10px] text-ink-muted truncate" title={status?.run_id}>
                {status?.run_id ? String(status.run_id).slice(0, 8) : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* 已完成步骤 */}
        {completedSteps.length > 0 && (
          <div className="panel bg-void-deep/60 p-2.5">
            <div className="text-[9px] font-mono uppercase tracking-wider text-ink-dim mb-1.5">
              completed_steps
            </div>
            <div className="flex flex-wrap gap-1.5">
              {completedSteps.map((step, i) => (
                <span key={i} className="tag-green text-[9px]">
                  ✓ {step}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 实时日志 */}
        <div className="panel bg-void-deep/80 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-void-border">
            <span className="text-[10px] font-mono uppercase tracking-wider text-ink-dim">
              demo_logs · live stream
            </span>
            <span className="text-[10px] font-mono text-ink-dim">
              {logs.length} lines
            </span>
          </div>
          <div
            className="h-[200px] overflow-y-auto p-2 font-mono text-[11px] space-y-0.5"
          >
            {logs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-ink-dim">
                <span className="animate-pulse">
                  {statusError ? '⚠ 状态信号丢失' : '等待 Demo 启动 · 日志将在此实时滚动...'}
                </span>
              </div>
            ) : (
              logs.map((log, i) => {
                const agentMatch = String(log?.msg || '').match(/Agent\s+([A-Ca-c])\b/i) || String(log?.msg || '').match(/\[([A-Ca-c])\]/i)
                const agent = agentMatch ? agentMatch[1].toUpperCase() : '--'
                const agentColor = AGENT_COLOR[agent] || 'text-ink-muted'
                const level = log?.level || 'info'
                const levelColor = level === 'error' ? 'text-neon-red' : level === 'warn' ? 'text-neon-amber' : 'text-ink-dim'
                return (
                  <div key={i} className="flex gap-2 leading-relaxed hover:bg-void-raised/30 px-1">
                    <span className="text-ink-dim shrink-0">{formatLogTime(log?.ts)}</span>
                    <span className={`shrink-0 font-bold ${agentColor}`}>[{agent}]</span>
                    <span className="shrink-0 text-neon-violet/70">--</span>
                    <span className={`shrink-0 ${levelColor}`}>{level}</span>
                    <span className="text-ink break-all">{log?.msg}</span>
                  </div>
                )
              })
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </section>
  )
}
