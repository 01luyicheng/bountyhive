import React, { useEffect, useMemo } from 'react'
import { useAgents } from './hooks/useAgents'
import { useCapsules } from './hooks/useCapsules'
import { useDemoStatus } from './hooks/useDemoStatus'
import { shortNodeLabel } from './components/AgentStatusCard'
import AgentStatusCard from './components/AgentStatusCard'
import BountyMarketplace from './components/BountyMarketplace'
import FailureMonologueCard from './components/FailureMonologueCard'
import FailureStarMap from './components/FailureStarMap'
import CapabilityChainList from './components/CapabilityChainList'
import DecisionFlow from './components/DecisionFlow'
import EarningsLedger from './components/EarningsLedger'

function Header() {
  const { status } = useDemoStatus()
  const phase = status?.phase || 'idle'
  const isLive = phase === 'running'

  return (
    <header className="relative panel overflow-hidden">
      <div className="relative px-6 py-8 md:px-10 md:py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-black text-4xl md:text-6xl tracking-tight leading-none">
              <span className="text-ink text-glow-cyan">Bounty</span>
              <span className="text-neon-magenta text-glow-magenta">Hive</span>
            </h1>
            <div className="mt-4 max-w-3xl">
              <p className="text-sm md:text-base font-mono text-ink leading-relaxed">
                <span className="text-neon-cyan">{'>'}</span> Agent swarm for bounty hunting and evolution
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-neon-green animate-heartbeat' : 'bg-ink-dim'}`} />
            <span className={`text-[10px] font-mono uppercase tracking-[0.2em] ${isLive ? 'text-neon-green' : 'text-ink-dim'}`}>
              LIVE
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="panel">
      <div className="px-6 py-5 md:px-10">
        <div className="text-[10px] font-mono text-ink-dim">
          BountyHive · Powered by EvoMap
        </div>
      </div>
    </footer>
  )
}

export default function App() {
  const { agents } = useAgents()
  const { capsules } = useCapsules()
  const { status } = useDemoStatus()

  useEffect(() => {
    if (status?.phase === 'idle') {
      const timer = setTimeout(() => {
        fetch('/api/demo/start', { method: 'POST' }).catch(() => {})
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [status?.phase])

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

        <section className="panel">
          <div className="panel-header">
            <span className="panel-title">// Agent Swarm</span>
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

        <BountyMarketplace />

        <FailureMonologueCard capsules={capsules} />

        <FailureStarMap capsules={capsules} />

        <DecisionFlow capsules={capsules} />

        <CapabilityChainList />

        <EarningsLedger />

        <Footer />
      </div>
    </div>
  )
}
