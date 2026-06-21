import React from 'react'

/**
 * 从 node_id 提取短标签（A / B / C）。
 * 兼容 "node_agent_a"、"agent_a"、"A" 等格式。
 */
export function shortNodeLabel(nodeId) {
  if (!nodeId) return '?'
  const s = String(nodeId)
  const m = s.match(/[_-]?([A-Ca-c])$/)
  if (m) return m[1].toUpperCase()
  return s.slice(0, 1).toUpperCase()
}

/**
 * Agent 状态卡片：展示节点缩写、online 心跳、reputation、model。
 */
export default function AgentStatusCard({ agent }) {
  const label = shortNodeLabel(agent?.node_id)
  const online = Boolean(agent?.online)
  const reputation = agent?.reputation ?? 0
  const model = agent?.model || 'unknown'

  const accent = online ? 'green' : 'dim'
  const ringClass = online
    ? 'border-neon-green/40 shadow-neon-green'
    : 'border-void-border opacity-60'

  return (
    <div className={`panel relative overflow-hidden transition-all duration-300 border ${ringClass}`}>
      <span className="corner-bracket tl" />
      <span className="corner-bracket tr" />
      <span className="corner-bracket bl" />
      <span className="corner-bracket br" />

      {/* 大号节点字母作为背景水印 */}
      <div
        className="absolute -right-2 -bottom-4 font-display font-black text-[7rem] leading-none select-none pointer-events-none"
        style={{
          color: online ? 'rgba(0, 255, 136, 0.06)' : 'rgba(138, 144, 176, 0.05)',
        }}
      >
        {label}
      </div>

      <div className="relative p-4 flex items-start gap-3">
        {/* 心跳指示灯 */}
        <div className="flex flex-col items-center pt-1">
          <div className="relative">
            {online && (
              <span className="absolute inset-0 rounded-full bg-neon-green/40 animate-ping" />
            )}
            <span
              className={`relative block w-3 h-3 rounded-full ${
                online ? 'bg-neon-green animate-heartbeat' : 'bg-ink-dim'
              }`}
              style={online ? { boxShadow: '0 0 10px rgba(0, 255, 136, 0.8)' } : {}}
            />
          </div>
          <span className="mt-1 text-[9px] font-mono uppercase tracking-wider text-ink-dim">
            {online ? 'live' : 'idle'}
          </span>
        </div>

        {/* 节点信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-ink text-glow-cyan">
              {label}
            </span>
            <span className="text-[10px] font-mono text-ink-dim uppercase tracking-wider">
              node
            </span>
          </div>

          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-ink-dim font-mono">reputation</span>
              <span className={`font-mono font-bold ${online ? 'text-neon-green' : 'text-ink-muted'}`}>
                {Number(reputation).toFixed(1)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-ink-dim font-mono">model</span>
              <span className="font-mono text-ink-muted truncate max-w-[140px]" title={model}>
                {model}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
