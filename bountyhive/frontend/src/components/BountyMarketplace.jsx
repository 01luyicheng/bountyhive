import React, { useState } from 'react'
import { useAgents } from '../hooks/useAgents'
import { useBounties } from '../hooks/useBounties'
import { useDemoStatus } from '../hooks/useDemoStatus'
import { shortNodeLabel } from './AgentStatusCard'

function BountyCard({ bounty }) {
  const signals = Array.isArray(bounty?.signals) ? bounty.signals : []
  const bountyAmount = bounty?.bounty ?? 0
  const status = bounty?.status || 'unknown'
  const isOwnedByA = shortNodeLabel(bounty?.owner) === 'A'

  const statusTag = {
    open: 'tag-cyan',
    claimed: 'tag-amber',
    completed: 'tag-green',
    failed: 'tag-red',
  }[status] || 'tag-dim'

  return (
    <div
      className={`relative panel p-3 transition-all duration-200 hover:border-neon-cyan/60 ${
        isOwnedByA ? 'border-neon-magenta/50 shadow-neon-magenta' : ''
      }`}
    >
      {isOwnedByA && (
        <div className="absolute -top-2 left-3 tag-magenta">A 发起</div>
      )}

      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-mono text-ink leading-tight flex-1">
          {bounty?.title || bounty?.task_id || '未命名悬赏'}
        </h4>
        <span className={statusTag}>{status}</span>
      </div>

      {signals.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {signals.slice(0, 4).map((sig, i) => (
            <span key={i} className="tag-dim text-[9px]">
              {sig}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-void-border">
        <span className="text-[10px] font-mono text-ink-dim uppercase tracking-wider">
          bounty
        </span>
        <span className="font-display text-lg font-bold text-neon-amber text-glow-amber">
          {bountyAmount}
          <span className="text-[10px] ml-1 text-ink-dim">credits</span>
        </span>
      </div>
    </div>
  )
}

/**
 * 悬赏市场总览：顶部蜂群上线动画 + 悬赏卡片网格。
 */
export default function BountyMarketplace() {
  const { agents } = useAgents()
  const { bounties, error, loading } = useBounties()
  const { status } = useDemoStatus()
  const [filterA, setFilterA] = useState(false)

  const onlineAgents = agents.filter((a) => a.online)
  const visibleBounties = filterA
    ? bounties.filter((b) => shortNodeLabel(b?.owner) === 'A')
    : bounties

  const demoStarted = status?.phase !== 'idle'

  return (
    <section className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-3">
          <span className="panel-title">// 03 · 悬赏市场</span>
          <span className="text-[10px] font-mono text-ink-dim">
            bounty_marketplace.feed
          </span>
        </div>
        <button
          onClick={() => setFilterA((v) => !v)}
          disabled={!demoStarted}
          className={`text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border transition-all ${
            filterA
              ? 'border-neon-magenta/60 text-neon-magenta bg-neon-magenta/10'
              : 'border-void-border text-ink-dim hover:text-ink-muted'
          } ${!demoStarted ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {filterA ? '◉ 仅看 A 发起' : '○ 仅看 A 发起'}
        </button>
      </div>

      <div className="panel-body space-y-4">
        {/* 蜂群上线动画 */}
        <div className="relative panel bg-void-deep/60 p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-neon-cyan/80">
              swarm_online · 蜂群上线
            </span>
            <span className="text-[10px] font-mono text-ink-dim">
              {onlineAgents.length}/{agents.length || 3} nodes heartbeat
            </span>
          </div>

          <div className="flex items-center justify-around gap-4">
            {(agents.length ? agents : [
              { node_id: 'node_agent_a', online: false },
              { node_id: 'node_agent_b', online: false },
              { node_id: 'node_agent_c', online: false },
            ]).slice(0, 3).map((agent, i) => {
              const label = shortNodeLabel(agent.node_id)
              const online = Boolean(agent.online)
              return (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className="relative">
                    {online && (
                      <span className="absolute inset-0 rounded-full bg-neon-green/30 animate-ping" />
                    )}
                    <div
                      className={`relative w-12 h-12 rounded-full border-2 flex items-center justify-center font-display text-lg font-bold ${
                        online
                          ? 'border-neon-green text-neon-green bg-neon-green/5'
                          : 'border-void-border text-ink-dim bg-void-raised'
                      }`}
                      style={online ? { boxShadow: '0 0 16px rgba(0, 255, 136, 0.5)' } : {}}
                    >
                      {label}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        online ? 'bg-neon-green animate-heartbeat' : 'bg-ink-dim'
                      }`}
                    />
                    <span className="text-[9px] font-mono uppercase tracking-wider text-ink-dim">
                      {online ? 'heartbeat' : 'standby'}
                    </span>
                  </div>
                </div>
              )
            })}

            {/* 连接线 */}
            <svg className="absolute inset-x-0 top-1/2 -translate-y-1/2 pointer-events-none" style={{ width: '100%', height: '2px' }}>
              <line x1="20%" y1="1" x2="80%" y2="1" stroke="rgba(0, 240, 255, 0.2)" strokeWidth="1" strokeDasharray="4 4" />
            </svg>
          </div>
        </div>

        {/* 悬赏卡片网格 */}
        {!demoStarted ? (
          <div className="text-center py-8 text-ink-dim text-xs font-mono">
            等待 Demo 启动 · 悬赏市场将在蜂群上线后激活
          </div>
        ) : error ? (
          <div className="text-center py-8 text-neon-red/80 text-xs font-mono">
            ⚠ 信号丢失: {error}
          </div>
        ) : loading ? (
          <div className="text-center py-8 text-ink-dim text-xs font-mono animate-pulse">
            正在接入悬赏市场...
          </div>
        ) : visibleBounties.length === 0 ? (
          <div className="text-center py-8 text-ink-dim text-xs font-mono">
            等待 Demo 启动 · 悬赏市场为空
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleBounties.map((b, i) => (
              <BountyCard key={b?.task_id || i} bounty={b} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
