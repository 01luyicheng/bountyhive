import React, { useMemo } from 'react'
import { useAgents } from './hooks/useAgents'
import { useCapsules } from './hooks/useCapsules'
import { shortNodeLabel } from './components/AgentStatusCard'
import AgentStatusCard from './components/AgentStatusCard'
import BountyMarketplace from './components/BountyMarketplace'
import FailureMonologueCard from './components/FailureMonologueCard'
import FailureStarMap from './components/FailureStarMap'
import CapabilityChainList from './components/CapabilityChainList'
import DecisionFlow from './components/DecisionFlow'
import EarningsLedger from './components/EarningsLedger'
import DemoControlPanel from './components/DemoControlPanel'

function Header() {
  return (
    <header className="relative panel overflow-hidden">
      {/* 装饰性背景六边形 */}
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <div className="absolute top-4 right-8 w-32 h-32 border border-neon-cyan/20 rotate-45 animate-float" />
        <div className="absolute -top-8 right-32 w-20 h-20 border border-neon-magenta/20 rotate-12 animate-float" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative px-6 py-8 md:px-10 md:py-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-neon-green animate-heartbeat" style={{ boxShadow: '0 0 8px rgba(0, 255, 136, 0.8)' }} />
            <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-neon-green/80">
              swarm_online
            </span>
          </div>
          <span className="text-[10px] font-mono text-ink-dim">|</span>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-ink-dim">
            evomap · 方案 E · v5
          </span>
        </div>

        <h1 className="font-display font-black text-4xl md:text-6xl tracking-tight leading-none">
          <span className="text-ink text-glow-cyan">Bounty</span>
          <span className="text-neon-magenta text-glow-magenta">Hive</span>
        </h1>

        <div className="mt-4 max-w-3xl">
          <p className="text-sm md:text-base font-mono text-ink leading-relaxed">
            <span className="text-neon-cyan">{'>'}</span> 悬赏市场蜂群接单进化体
          </p>
          <p className="mt-2 text-base md:text-lg font-mono text-ink leading-relaxed">
            <span className="text-neon-amber">"</span>
            一只 Agent 踩过的坑，整个蜂群再也不必踩第二次。
            <span className="text-neon-amber">"</span>
          </p>
        </div>

        {/* 5 个视觉高光时刻索引 */}
        <div className="mt-6 flex flex-wrap gap-2">
          {[
            { n: '01', label: '蜂群上线', color: 'cyan' },
            { n: '02', label: '失败独白', color: 'red' },
            { n: '03', label: '发现瞬间', color: 'magenta' },
            { n: '04', label: '能力链生长', color: 'violet' },
            { n: '05', label: '积分到账', color: 'green' },
          ].map((m) => (
            <span
              key={m.n}
              className={`tag tag-${m.color} text-[10px]`}
            >
              {m.n} · {m.label}
            </span>
          ))}
        </div>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="panel">
      <div className="px-6 py-5 md:px-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded border border-neon-cyan/40 flex items-center justify-center">
              <span className="font-display text-xs font-bold text-neon-cyan">E</span>
            </div>
            <div>
              <div className="font-display text-xs font-bold tracking-wider text-ink">
                BountyHive · 方案 E v5 准确版
              </div>
              <div className="text-[10px] font-mono text-ink-dim">
                The Forge 主线 · The Pearl 辅线
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-ink-dim">
            <span>evomap-skill-docs/</span>
            <span className="text-ink-dim/50">·</span>
            <span>gep-a2a protocol</span>
            <span className="text-ink-dim/50">·</span>
            <span>credit marketplace</span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-void-border text-[10px] font-mono text-ink-dim/70">
          一只 Agent 踩过的坑，整个蜂群再也不必踩第二次。
        </div>
      </div>
    </footer>
  )
}

export default function App() {
  const { agents } = useAgents()
  const { capsules } = useCapsules()

  // 始终展示 A/B/C 三个槽位，按字母顺序排列
  const normalizedAgents = useMemo(() => {
    const slots = [
      { node_id: 'node_agent_a', online: false, reputation: 0, model: 'standby' },
      { node_id: 'node_agent_b', online: false, reputation: 0, model: 'standby' },
      { node_id: 'node_agent_c', online: false, reputation: 0, model: 'standby' },
    ]
    agents.forEach((a) => {
      const label = shortNodeLabel(a?.node_id)
      const idx = ['A', 'B', 'C'].indexOf(label)
      if (idx >= 0) slots[idx] = a
    })
    return slots
  }, [agents])

  return (
    <div className="relative z-10 min-h-screen">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-6 space-y-5">
        <Header />

        {/* 01 · Demo 控制台 */}
        <DemoControlPanel />

        {/* 02 · 蜂群状态 */}
        <section className="panel">
          <div className="panel-header">
            <span className="panel-title">// 02 · 蜂群状态</span>
            <span className="text-[10px] font-mono text-ink-dim">
              3 nodes · A / B / C
            </span>
          </div>
          <div className="panel-body">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {normalizedAgents.map((agent, i) => (
                <AgentStatusCard key={i} agent={agent} />
              ))}
            </div>
          </div>
        </section>

        {/* 04 · 悬赏市场 */}
        <BountyMarketplace />

        {/* 05 · 失败独白 */}
        <FailureMonologueCard capsules={capsules} />

        {/* 06 · 失败经验星图 */}
        <FailureStarMap capsules={capsules} />

        {/* 06.5 · 决策流 */}
        <DecisionFlow capsules={capsules} />

        {/* 07 · 能力链 */}
        <CapabilityChainList />

        {/* 08 · 积分流水 */}
        <EarningsLedger />

        <Footer />
      </div>
    </div>
  )
}
