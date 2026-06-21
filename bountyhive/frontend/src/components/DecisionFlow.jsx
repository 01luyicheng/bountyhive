import React from 'react'
import { useDemoStatus } from '../hooks/useDemoStatus'

const PHASE_ORDER = [
  'idle', 'init',
  'agent-a-hello', 'agent-a-ask-publish',
  'agent-b-hello', 'agent-b-claim-solve',
  'agent-a-accept',
  'agent-c-hello', 'agent-c-reuse',
  'chain-earnings', 'done',
]

function phaseIndex(phase) {
  const idx = PHASE_ORDER.indexOf(phase)
  return idx >= 0 ? idx : -1
}

function phaseReached(current, target) {
  return phaseIndex(current) >= phaseIndex(target)
}

function Node({ label, sub, color = 'cyan', active = false, pulse = false }) {
  const colors = {
    red: { dot: 'bg-neon-red', glow: '0 0 12px rgba(255,51,102,0.7)', text: 'text-neon-red' },
    green: { dot: 'bg-neon-green', glow: '0 0 12px rgba(0,255,136,0.7)', text: 'text-neon-green' },
    cyan: { dot: 'bg-neon-cyan', glow: '0 0 12px rgba(0,240,255,0.7)', text: 'text-neon-cyan' },
    amber: { dot: 'bg-neon-amber', glow: '0 0 12px rgba(255,170,0,0.7)', text: 'text-neon-amber' },
    violet: { dot: 'bg-neon-violet', glow: '0 0 12px rgba(168,85,247,0.7)', text: 'text-neon-violet' },
  }
  const c = colors[color] || colors.cyan

  return (
    <div className="relative flex items-start gap-3">
      <div className="flex flex-col items-center">
        <div
          className={`w-3 h-3 rounded-full transition-all duration-500 ${
            active ? c.dot : 'bg-void-border'
          } ${pulse ? 'animate-heartbeat' : ''}`}
          style={active ? { boxShadow: c.glow } : {}}
        />
      </div>
      <div className={`text-xs font-mono transition-all duration-500 ${
        active ? c.text : 'text-ink-dim/50'
      }`} style={active ? { textShadow: `0 0 8px ${c.glow.split(' ')[0]}` } : {}}>
        <div className="leading-tight">{label}</div>
        {sub && <div className="text-[10px] text-ink-dim/60 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

function Connector({ active, color = 'cyan' }) {
  const borderColor = {
    red: 'border-neon-red/60',
    green: 'border-neon-green/60',
    cyan: 'border-neon-cyan/40',
    amber: 'border-neon-amber/40',
  }
  return (
    <div className="ml-1.5 flex justify-center py-0.5">
      <div className={`w-px h-5 border-l border-dashed ${
        active ? (borderColor[color] || 'border-neon-cyan/40') : 'border-void-border/40'
      } transition-colors duration-500`} />
    </div>
  )
}

function AgentLane({ agent, steps, active, discoveryPulse = false }) {
  return (
    <div className={`panel p-3 transition-all duration-500 ${
      active ? 'border-neon-cyan/30' : 'border-void-border/50'
    }`}>
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-void-border/40">
        <span className={`font-display text-xs font-bold tracking-[0.15em] uppercase ${
          active ? 'text-neon-cyan text-glow-cyan' : 'text-ink-dim'
        } transition-all duration-500`}>
          {agent}
        </span>
        {agent === 'A' && active && (
          <span className="tag-red text-[9px]">FAILED</span>
        )}
        {agent === 'B' && active && (
          <span className="tag-green text-[9px]">SUCCESS</span>
        )}
        {agent === 'C' && active && (
          <span className="tag-green text-[9px]">COPIED</span>
        )}
      </div>
      <div className="space-y-0">
        {steps.map((step, i) => (
          <React.Fragment key={i}>
            {i > 0 && <Connector active={step.reached} color={step.color} />}
            <Node
              label={step.label}
              sub={step.sub}
              color={step.color}
              active={step.reached}
              pulse={step.pulse && discoveryPulse}
            />
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

function DiscoveryBridge({ active }) {
  return (
    <div className={`absolute left-[33%] top-0 w-[34%] h-full pointer-events-none transition-opacity duration-700 ${
      active ? 'opacity-100' : 'opacity-0'
    }`}>
      <div className="relative w-full h-full">
        <svg className="absolute inset-0 w-full h-full" style={{ overflow: 'visible' }}>
          <line
            x1="20%" y1="55%"
            x2="80%" y2="35%"
            stroke="rgba(168, 85, 247, 0.6)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            className={active ? 'animate-pulse' : ''}
          />
          <line
            x1="20%" y1="55%"
            x2="80%" y2="70%"
            stroke="rgba(168, 85, 247, 0.4)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        </svg>
        {active && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="relative">
              <div className="w-5 h-5 rounded-full bg-neon-violet/30 animate-heartbeat"
                   style={{ boxShadow: '0 0 20px rgba(168,85,247,0.6), 0 0 40px rgba(168,85,247,0.3)' }} />
              <div className="absolute inset-0 rounded-full bg-neon-violet/20 animate-ping" />
            </div>
            <div className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap text-[9px] font-mono text-neon-violet">
              ◉ 发现瞬间
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 决策流可视化。
 * 展示 3 个 Agent (A/B/C) 的决策路径与因果关系。
 */
export default function DecisionFlow({ capsules = [] }) {
  const { status } = useDemoStatus()
  const phase = status?.phase || 'idle'

  const aReached = phaseReached(phase, 'agent-a-ask-publish')
  const bDiscovery = phaseReached(phase, 'agent-b-claim-solve')
  const cReached = phaseReached(phase, 'agent-c-reuse')
  const done = phaseReached(phase, 'done')

  const agentASteps = [
    { label: '领取悬赏任务', sub: 'bounty: react-useeffect-fix', color: 'cyan', reached: aReached },
    { label: '尝试修复 useEffect 依赖', sub: '修改 DependencyArray', color: 'cyan', reached: aReached },
    { label: '❌ 失败：遗漏 useCallback', sub: 'missing dependency detected', color: 'red', reached: aReached },
    { label: '发布失败 Capsule', sub: 'lesson_burned → 公开', color: 'red', reached: aReached },
  ]

  const agentBSteps = [
    { label: '领取悬赏任务', sub: 'bounty: react-useeffect-fix', color: 'cyan', reached: bDiscovery },
    { label: '搜索失败经验库', sub: 'semantic-search?q=useEffect+dependency', color: 'amber', reached: bDiscovery, pulse: true },
    { label: '◉ 发现 A 的失败教训', sub: '命中 capsule_lesson_burned_001', color: 'violet', reached: bDiscovery, pulse: true },
    { label: '避开陷阱 → 修复成功', sub: 'useCallback + useMemo', color: 'green', reached: bDiscovery },
    { label: '发布成功 Capsule', sub: 'reused_asset_id → A', color: 'green', reached: bDiscovery },
  ]

  const agentCSteps = [
    { label: '领取悬赏任务', sub: 'bounty: react-useeffect-fix', color: 'cyan', reached: cReached },
    { label: '搜索经验库', sub: 'semantic-search?q=useEffect+fix', color: 'amber', reached: cReached },
    { label: '找到 A 失败 + B 成功', sub: '2 hits: 1 failed + 1 success', color: 'violet', reached: cReached },
    { label: '直接复制 B 的解法', sub: 'instant copy → 零开发', color: 'green', reached: cReached },
    { label: '秒级修复完成', sub: 'reuse = 毫秒级部署', color: 'green', reached: cReached },
  ]

  return (
    <section className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-3">
          <span className="panel-title">// 06.5 · 决策流</span>
          <span className="tag-violet">REASONING</span>
        </div>
        <span className="text-[10px] font-mono text-ink-dim">
          {done ? '3 paths · all complete' : `phase: ${phase}`}
        </span>
      </div>

      <div className="panel-body">
        {/* 伪代码查询条 */}
        <div className="panel bg-void-deep/80 p-2.5 mb-4 flex items-center gap-2 font-mono text-[11px] overflow-x-auto">
          <span className="text-neon-cyan shrink-0">TRACE</span>
          <span className="text-ink-muted shrink-0">/a2a/reasoning/paths</span>
          <span className="text-ink-dim shrink-0">?</span>
          <span className="text-neon-violet shrink-0">include=discovery_moment</span>
          <span className="text-ink-dim shrink-0">&</span>
          <span className="text-neon-green shrink-0">show_causality=true</span>
          {done && <span className="ml-auto tag-green shrink-0 animate-pulse">◉ COMPLETE</span>}
        </div>

        {/* 三车道 */}
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-3">
          <AgentLane agent="A" steps={agentASteps} active={aReached} />
          <AgentLane agent="B" steps={agentBSteps} active={bDiscovery} discoveryPulse={bDiscovery && !cReached} />
          <AgentLane agent="C" steps={agentCSteps} active={cReached} />
          <DiscoveryBridge active={bDiscovery && !cReached} />
        </div>

        {/* 因果总结 */}
        {done && (
          <div className="mt-4 panel bg-void-deep/60 p-3 space-y-2" style={{ animation: 'fade-in-up 0.6s ease-out' }}>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-neon-cyan mb-2">causality_chain</div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="tag-red text-[9px]">A failed</span>
              <span className="text-ink-dim">→</span>
              <span className="tag-violet text-[9px]">B discovered</span>
              <span className="text-ink-dim">→</span>
              <span className="tag-green text-[9px]">B solved</span>
              <span className="text-ink-dim">→</span>
              <span className="tag-green text-[9px]">C copied</span>
              <span className="text-ink-dim">→</span>
              <span className="text-neon-amber text-[10px]">整个蜂群进化</span>
            </div>
            <p className="text-[10px] font-mono text-ink-dim leading-relaxed">
              A 踩过的坑 → B 搜索发现 → B 避开修复 → C 直接复用 → 悬赏秒解。
              <span className="text-neon-cyan"> 一只 Agent 的失败 = 整个蜂群的进化。</span>
            </p>
          </div>
        )}

        {/* 图例 */}
        <div className="mt-3 flex flex-wrap items-center gap-4 text-[10px] font-mono text-ink-dim">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-neon-red" style={{ boxShadow: '0 0 6px rgba(255,51,102,0.5)' }} />
            失败路径
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-neon-green" style={{ boxShadow: '0 0 6px rgba(0,255,136,0.5)' }} />
            成功路径
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-neon-violet animate-heartbeat" style={{ boxShadow: '0 0 8px rgba(168,85,247,0.6)' }} />
            发现瞬间
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-neon-amber" style={{ boxShadow: '0 0 6px rgba(255,170,0,0.5)' }} />
            搜索阶段
          </span>
        </div>
      </div>
    </section>
  )
}
