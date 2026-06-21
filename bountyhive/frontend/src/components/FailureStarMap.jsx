import React, { useEffect, useRef, useState } from 'react'
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

function hashStr(s) {
  let h = 0
  for (let i = 0; i < String(s).length; i++) {
    h = (h * 31 + String(s).charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function starPosition(id, index, total) {
  const h = hashStr(id || `star-${index}`)
  const x = ((h % 100) / 100) * 84 + 8 // 8-92%
  const y = (((h >> 8) % 100) / 100) * 80 + 10 // 10-90%
  return { x, y }
}

/**
 * 失败经验星图 + 发现瞬间特写。
 * 接收 failed capsules（来自 useCapsules），并自行轮询全部 capsules 以获取 success 节点。
 * 当 B 的 success Capsule 通过 reused_asset_id / parent 溯源到 A 的 failed Capsule 时，
 * A 的星被"点亮"（ignite 动画）。
 */
export default function FailureStarMap({ capsules = [] }) {
  const { status } = useDemoStatus()
  const [allCapsules, setAllCapsules] = useState([])
  const [error, setError] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const res = await fetch('/api/capsules')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!cancelled) {
          setAllCapsules(Array.isArray(data?.capsules) ? data.capsules : [])
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e.message)
      }
    }
    poll()
    timerRef.current = setInterval(poll, 3000)
    return () => {
      cancelled = true
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // 合并：优先用 allCapsules，回退到传入的 failed capsules
  const failedCapsules = allCapsules.length
    ? allCapsules.filter((c) => c?.outcome?.status === 'failed')
    : capsules
  const successCapsules = allCapsules.filter((c) => c?.outcome?.status === 'success')

  // 找到 A 的 burned capsule（优先匹配 capsule_lesson_burned_001）
  const aCapsule = failedCapsules.find(
    (c) => (c?.asset_id || c?.id || '').includes('capsule_lesson_burned_001')
  ) || failedCapsules[0]

  const aCapsuleId = aCapsule?.asset_id || aCapsule?.id

  // 判断是否被发现：存在 success capsule 的 reused_asset_id 或 parent 指向 aCapsuleId
  const discovered = Boolean(
    aCapsuleId &&
    successCapsules.some(
      (c) => c?.reused_asset_id === aCapsuleId || c?.parent === aCapsuleId
    )
  )

  const totalStars = failedCapsules.length + successCapsules.length

  // Demo 未到 B 认领并搜索失败经验阶段时显示占位
  if (!phaseReached(status?.phase, 'agent-b-claim-solve')) {
    return (
      <section className="panel">
        <div className="panel-header">
          <span className="panel-title">// 05 · 失败经验星图</span>
          <span className="text-[10px] font-mono text-ink-dim">awaiting_discovery</span>
        </div>
        <div className="panel-body">
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-12 h-12 rounded-full border border-void-border flex items-center justify-center mb-3">
              <span className="text-ink-dim text-xl">·</span>
            </div>
            <p className="text-xs font-mono text-ink-dim">
              等待 Agent B 搜索失败经验...
            </p>
            <p className="text-[10px] font-mono text-ink-dim/60 mt-1">
              发现瞬间将在 B 命中 A 的 Capsule 时点亮
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
          <span className="panel-title">// 05 · 失败经验星图</span>
          <span className="tag-cyan">EVOLUTION</span>
        </div>
        <span className="text-[10px] font-mono text-ink-dim">
          {totalStars} stars · {failedCapsules.length} failed · {successCapsules.length} success
        </span>
      </div>

      <div className="panel-body space-y-3">
        {/* semantic-search 查询条 */}
        <div className="panel bg-void-deep/80 p-2.5 flex items-center gap-2 font-mono text-[11px] overflow-x-auto">
          <span className="text-neon-cyan shrink-0">GET</span>
          <span className="text-ink-muted shrink-0">/a2a/assets/semantic-search</span>
          <span className="text-ink-dim shrink-0">?</span>
          <span className="text-neon-amber shrink-0">q=useEffect+dependency</span>
          <span className="text-ink-dim shrink-0">&</span>
          <span className="text-neon-magenta shrink-0">outcome=failed</span>
          <span className="text-ink-dim shrink-0">&</span>
          <span className="text-neon-green shrink-0">include_context=true</span>
          {discovered && (
            <span className="ml-auto tag-green shrink-0 animate-pulse">◉ HIT</span>
          )}
        </div>

        {/* 星图本体 */}
        <div className="relative panel bg-void-deep/80 overflow-hidden" style={{ height: '320px' }}>
          {/* 背景网格 */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(0, 240, 255, 0.15) 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* 背景装饰星（随机闪烁） */}
          {Array.from({ length: 40 }).map((_, i) => {
            const h = hashStr(`bg-${i}`)
            const x = (h % 1000) / 10
            const y = ((h >> 8) % 1000) / 10
            const delay = (h % 30) / 10
            return (
              <span
                key={`bg-${i}`}
                className="absolute w-px h-px bg-ink-muted/40 animate-star-twinkle"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  animationDelay: `${delay}s`,
                }}
              />
            )
          })}

          {/* 真实 Capsule 星 */}
          {totalStars === 0 && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-xs font-mono text-ink-dim">
              等待 Capsule 沉淀 · 星图待点亮
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center text-xs font-mono text-neon-red/70">
              ⚠ 星图信号丢失
            </div>
          )}

          {/* 失败星（红色） */}
          {failedCapsules.map((c, i) => {
            const id = c?.asset_id || c?.id || `failed-${i}`
            const isIgnited = discovered && id === aCapsuleId
            const { x, y } = starPosition(id, i, totalStars)
            return (
              <div
                key={`f-${id}`}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <div
                  className={`relative rounded-full ${
                    isIgnited
                      ? 'bg-neon-red animate-star-ignite'
                      : 'bg-neon-red/70'
                  }`}
                  style={{
                    width: isIgnited ? '14px' : '8px',
                    height: isIgnited ? '14px' : '8px',
                    boxShadow: isIgnited
                      ? '0 0 20px rgba(255, 51, 102, 0.9), 0 0 40px rgba(255, 51, 102, 0.5)'
                      : '0 0 6px rgba(255, 51, 102, 0.5)',
                  }}
                >
                  {isIgnited && (
                    <span className="absolute inset-0 rounded-full bg-neon-red/40 animate-ping" />
                  )}
                </div>
                {isIgnited && (
                  <div
                    className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap text-[9px] font-mono text-neon-red text-glow-red"
                    style={{ animation: 'fade-in 0.5s ease-out 0.8s both' }}
                  >
                    ◉ A · discovered
                  </div>
                )}
              </div>
            )
          })}

          {/* 成功星（绿色） */}
          {successCapsules.map((c, i) => {
            const id = c?.asset_id || c?.id || `success-${i}`
            const { x, y } = starPosition(id, i + 100, totalStars)
            const isReusedFromA = aCapsuleId && (c?.reused_asset_id === aCapsuleId || c?.parent === aCapsuleId)
            return (
              <div
                key={`s-${id}`}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <div
                  className="rounded-full bg-neon-green"
                  style={{
                    width: '10px',
                    height: '10px',
                    boxShadow: '0 0 10px rgba(0, 255, 136, 0.7)',
                  }}
                />
                {isReusedFromA && (
                  <div className="absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap text-[9px] font-mono text-neon-green text-glow-green">
                    B · reused
                  </div>
                )}
              </div>
            )
          })}

          {/* 溯源连线（A → B） */}
          {discovered && aCapsuleId && (() => {
            const aPos = starPosition(aCapsuleId, failedCapsules.findIndex((c) => (c?.asset_id || c?.id) === aCapsuleId), totalStars)
            const bCapsule = successCapsules.find((c) => c?.reused_asset_id === aCapsuleId || c?.parent === aCapsuleId)
            if (!bCapsule) return null
            const bId = bCapsule.asset_id || bCapsule.id
            const bPos = starPosition(bId, successCapsules.indexOf(bCapsule) + 100, totalStars)
            return (
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
                <line
                  x1={`${aPos.x}%`}
                  y1={`${aPos.y}%`}
                  x2={`${bPos.x}%`}
                  y2={`${bPos.y}%`}
                  stroke="rgba(0, 240, 255, 0.5)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  style={{ animation: 'fade-in 1s ease-out 1.2s both' }}
                />
              </svg>
            )
          })()}
        </div>

        {/* 图例 */}
        <div className="flex items-center justify-between text-[10px] font-mono">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-neon-red" style={{ boxShadow: '0 0 6px rgba(255, 51, 102, 0.6)' }} />
              <span className="text-ink-dim">failed capsule</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-neon-green" style={{ boxShadow: '0 0 6px rgba(0, 255, 136, 0.6)' }} />
              <span className="text-ink-dim">success capsule</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-neon-red animate-pulse" />
              <span className="text-ink-dim">ignited (discovered)</span>
            </span>
          </div>
          {discovered && (
            <span className="text-neon-cyan text-glow-cyan animate-pulse">
              ◉ 发现瞬间 · B semantic-search 命中 A 的失败经验
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
