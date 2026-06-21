import React, { useEffect, useRef, useState } from 'react'
import { useDemoStatus } from '../hooks/useDemoStatus'

const DEFAULT_AGENT_ID = 'node_agent_a'

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

function shortNode(id) {
  if (!id) return '—'
  const s = String(id)
  const m = s.match(/([A-Ca-c])$/)
  if (m) return m[1].toUpperCase()
  return s.slice(0, 6)
}

/**
 * 积分流水表格。
 * 轮询 GET /api/earnings/:agentId，展示 A 的积分流水。
 * 高亮 fetch 奖励行（B fetch A 的 Capsule 时 A 获积分）。
 */
export default function EarningsLedger({ agentId = DEFAULT_AGENT_ID }) {
  const { status } = useDemoStatus()
  const [data, setData] = useState({ agent_id: agentId, total: 0, earnings: [] })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const timerRef = useRef(null)

  const demoCompleted = status?.status === 'completed' || status?.phase === 'done'

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const res = await fetch(`/api/earnings/${agentId}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        if (!cancelled) {
          setData(json || {})
          setError(null)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message)
          setLoading(false)
        }
      }
    }
    poll()
    timerRef.current = setInterval(poll, 3000)
    return () => {
      cancelled = true
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [agentId])

  const entries = data?.earnings || []
  const total = data?.total ?? 0
  const fetchEntries = entries.filter((e) =>
    String(e?.reason || '').toLowerCase().includes('fetch')
  )

  // Demo 未完成时显示占位
  if (!demoCompleted) {
    return (
      <section className="panel">
        <div className="panel-header">
          <span className="panel-title">// 07 · 积分流水</span>
          <span className="text-[10px] font-mono text-ink-dim">awaiting_settlement</span>
        </div>
        <div className="panel-body">
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-12 h-12 rounded-full border border-void-border flex items-center justify-center mb-3">
              <span className="text-ink-dim text-xl">·</span>
            </div>
            <p className="text-xs font-mono text-ink-dim">
              等待 Demo 完成结算...
            </p>
            <p className="text-[10px] font-mono text-ink-dim/60 mt-1">
              积分到账后流水将在此显示
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-3">
          <span className="panel-title">// 07 · 积分流水</span>
          <span className="tag-green">ENDING</span>
        </div>
        <span className="text-[10px] font-mono text-ink-dim">
          agent: <span className="text-neon-cyan">{shortNode(data?.agent_id || agentId)}</span>
        </span>
      </div>

      <div className="panel-body space-y-3">
        {/* 总积分 + fetch 统计 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="panel bg-void-deep/60 p-3 relative overflow-hidden">
            <div className="text-[9px] font-mono uppercase tracking-wider text-ink-dim mb-1">
              total_credits
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-bold text-neon-amber text-glow-amber">
                {Number(total).toFixed(0)}
              </span>
              <span className="text-[10px] font-mono text-ink-dim">credits</span>
            </div>
            <div
              className="absolute -right-3 -bottom-3 w-16 h-16 rounded-full opacity-20"
              style={{ background: 'radial-gradient(circle, #ffaa00, transparent 70%)' }}
            />
          </div>
          <div className="panel bg-void-deep/60 p-3">
            <div className="text-[9px] font-mono uppercase tracking-wider text-ink-dim mb-1">
              fetch_rewards
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-bold text-neon-green text-glow-green">
                {fetchEntries.length}
              </span>
              <span className="text-[10px] font-mono text-ink-dim">
                · {fetchEntries.reduce((s, e) => s + (e.amount || 0), 0)} credits
              </span>
            </div>
          </div>
        </div>

        {/* 流水表格 */}
        <div className="panel bg-void-deep/60 overflow-hidden">
          <div className="grid grid-cols-[100px_60px_80px_1fr] gap-2 px-3 py-2 border-b border-void-border text-[9px] font-mono uppercase tracking-wider text-ink-dim">
            <span>timestamp</span>
            <span>from</span>
            <span className="text-right">amount</span>
            <span>reason</span>
          </div>

          <div className="max-h-[260px] overflow-y-auto">
            {loading ? (
              <div className="px-3 py-6 text-center text-xs font-mono text-ink-dim animate-pulse">
                正在拉取积分流水...
              </div>
            ) : entries.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs font-mono text-ink-dim">
                {error ? '⚠ 流水信号丢失' : '等待 Demo 启动 · 暂无积分流水'}
              </div>
            ) : (
              entries.map((entry, i) => {
                const isFetch = String(entry?.reason || '').toLowerCase().includes('fetch')
                return (
                  <div
                    key={i}
                    className={`grid grid-cols-[100px_60px_80px_1fr] gap-2 px-3 py-2 border-b border-void-border/50 text-[11px] font-mono transition-colors ${
                      isFetch
                        ? 'bg-neon-green/5 hover:bg-neon-green/10'
                        : 'hover:bg-void-raised/50'
                    }`}
                  >
                    <span className="text-ink-dim">{formatTime(entry?.timestamp)}</span>
                    <span className={isFetch ? 'text-neon-green' : 'text-ink-muted'}>
                      {shortNode(entry?.from_node)}
                    </span>
                    <span className={`text-right font-bold ${isFetch ? 'text-neon-green text-glow-green' : 'text-neon-amber'}`}>
                      +{entry?.amount ?? 0}
                    </span>
                    <span className={`truncate ${isFetch ? 'text-neon-green' : 'text-ink-muted'}`} title={entry?.reason}>
                      {isFetch && <span className="mr-1">◉</span>}
                      {entry?.reason || '—'}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="text-[10px] font-mono text-ink-dim flex items-center gap-2">
          <span className="inline-block w-2 h-2 bg-neon-green/30 rounded-sm" />
          高亮行 = fetch 奖励（B fetch A 的 Capsule 时 A 获积分，0-12 分档）
        </div>
      </div>
    </section>
  )
}
