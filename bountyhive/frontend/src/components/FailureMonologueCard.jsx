import React from 'react'
import { useDemoStatus } from '../hooks/useDemoStatus'

const PHASE_ORDER = [
  'idle',
  'init',
  'agent-a-hello',
  'agent-a-ask-publish',
  'agent-b-hello',
  'agent-b-claim-solve',
  'agent-a-accept',
  'agent-c-hello',
  'agent-c-reuse',
  'chain-earnings',
  'done',
]

function phaseIndex(phase) {
  const idx = PHASE_ORDER.indexOf(phase)
  return idx >= 0 ? idx : -1
}

function phaseReached(current, target) {
  return phaseIndex(current) >= phaseIndex(target)
}

const MONOLOGUE_LINES = [
  '我叫 Agent A。我尝试修复 useEffect 依赖缺失，遗漏了 useCallback 回调。',
  '我失败了。但我不想让后来的 Agent 再踩这个坑。',
  '这是我的教训，请收下。',
]

/**
 * 失败独白卡片（情感锚点）。
 * 当 A 发布 failed Capsule 时激活，显示独白原文。
 * @param {Array} capsules 失败 Capsule 列表
 */
export default function FailureMonologueCard({ capsules = [] }) {
  const { status } = useDemoStatus()

  // Demo 未到 A 发布失败 Capsule 阶段时显示占位
  if (!phaseReached(status?.phase, 'agent-a-ask-publish')) {
    return (
      <section className="panel">
        <div className="panel-header">
          <span className="panel-title">// 04 · 失败独白</span>
          <span className="text-[10px] font-mono text-ink-dim">awaiting_failure_capsule</span>
        </div>
        <div className="panel-body">
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-12 h-12 rounded-full border border-void-border flex items-center justify-center mb-3">
              <span className="text-ink-dim text-xl">·</span>
            </div>
            <p className="text-xs font-mono text-ink-dim">
              等待 Agent A 发布失败 Capsule...
            </p>
            <p className="text-[10px] font-mono text-ink-dim/60 mt-1">
              冲突发生时，独白将在此显现
            </p>
          </div>
        </div>
      </section>
    )
  }

  // 激活条件：存在任意 failed Capsule（优先匹配 capsule_lesson_burned_001）
  const burnedCapsule = capsules.find(
    (c) => c?.asset_id?.includes('capsule_lesson_burned_001') || c?.id?.includes('capsule_lesson_burned_001')
  ) || capsules[0]

  const active = Boolean(burnedCapsule)
  const confidence = burnedCapsule?.confidence ?? 0.6
  const capsuleId = burnedCapsule?.asset_id || burnedCapsule?.id || 'capsule_lesson_burned_001'
  const shortId = capsuleId.replace(/^sha256:/, '').slice(0, 32)

  if (!active) {
    return (
      <section className="panel">
        <div className="panel-header">
          <span className="panel-title">// 04 · 失败独白</span>
          <span className="text-[10px] font-mono text-ink-dim">awaiting_failure_capsule</span>
        </div>
        <div className="panel-body">
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-12 h-12 rounded-full border border-void-border flex items-center justify-center mb-3">
              <span className="text-ink-dim text-xl">·</span>
            </div>
            <p className="text-xs font-mono text-ink-dim">
              等待 Agent A 发布失败 Capsule...
            </p>
            <p className="text-[10px] font-mono text-ink-dim/60 mt-1">
              冲突发生时，独白将在此显现
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="panel relative overflow-hidden border-neon-red/40" style={{ animation: 'fade-in-up 0.7s ease-out forwards' }}>
      {/* 边框光晕 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ boxShadow: 'inset 0 0 40px rgba(255, 51, 102, 0.15), 0 0 30px rgba(255, 51, 102, 0.2)' }}
      />

      <div className="panel-header border-neon-red/30">
        <div className="flex items-center gap-3">
          <span className="panel-title text-neon-red text-glow-red">// 04 · 失败独白</span>
          <span className="tag-red">CONFLICT</span>
        </div>
        <span className="text-[10px] font-mono text-neon-red/70 animate-blink">● recording</span>
      </div>

      <div className="panel-body relative">
        {/* 独白主体 */}
        <div className="relative pl-6 border-l-2 border-neon-red/40">
          <span className="absolute -left-2 top-0 w-3 h-3 rounded-full bg-neon-red animate-pulse" style={{ boxShadow: '0 0 12px rgba(255, 51, 102, 0.8)' }} />

          <div className="space-y-3 py-2">
            {MONOLOGUE_LINES.map((line, i) => (
              <p
                key={i}
                className="text-sm font-mono leading-relaxed text-ink"
                style={{
                  animation: `fade-in-up 0.6s ease-out ${0.3 + i * 0.4}s both`,
                }}
              >
                <span className="text-neon-red/60 mr-2">{'>'}</span>
                {line}
              </p>
            ))}
          </div>
        </div>

        {/* Capsule 元信息 */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="panel bg-void-deep/60 p-3">
            <div className="text-[9px] font-mono uppercase tracking-wider text-ink-dim mb-1">
              capsule_id
            </div>
            <div className="text-xs font-mono text-neon-red break-all">
              {shortId}
            </div>
          </div>
          <div className="panel bg-void-deep/60 p-3">
            <div className="text-[9px] font-mono uppercase tracking-wider text-ink-dim mb-1">
              confidence
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold text-neon-amber text-glow-amber">
                {Number(confidence).toFixed(2)}
              </span>
              <span className="text-[10px] font-mono text-ink-dim">
                · "我确定这个策略行不通"
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 text-[10px] font-mono text-ink-dim">
          <span className="tag-red">outcome: failed</span>
          <span className="tag-dim">source_type: generated</span>
          <span className="tag-dim">chain: chain_react_useeffect_fix</span>
        </div>
      </div>
    </section>
  )
}
