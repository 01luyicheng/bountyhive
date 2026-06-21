import React, { useEffect, useRef, useState } from 'react'
import { useDemoStatus } from '../hooks/useDemoStatus'

const DEFAULT_CHAIN_ID = 'chain_react_useeffect_fix'

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

function shortAssetId(id) {
  if (!id) return '?'
  const s = String(id).replace(/^sha256:/, '')
  if (s.length <= 16) return s
  return `${s.slice(0, 8)}…${s.slice(-4)}`
}

function buildTree(assets) {
  if (!Array.isArray(assets) || assets.length === 0) return []
  const map = new Map()
  assets.forEach((a) => {
    const id = a?.asset_id || a?.id
    if (id) map.set(id, { ...a, asset_id: id, children: [] })
  })
  const roots = []
  map.forEach((node) => {
    const parentId = node.parent
    if (parentId && map.has(parentId)) {
      map.get(parentId).children.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

function ChainNode({ node, depth = 0 }) {
  const outcome = node?.outcome?.status || 'unknown'
  const isFailed = outcome === 'failed'
  const isSuccess = outcome === 'success'

  const outcomeTag = isFailed
    ? 'tag-red'
    : isSuccess
    ? 'tag-green'
    : 'tag-dim'

  const accentColor = isFailed ? 'neon-red' : isSuccess ? 'neon-green' : 'ink-muted'

  return (
    <div className="relative">
      {/* 缩进 + 连线 */}
      {depth > 0 && (
        <div className="absolute left-0 top-0 bottom-0 flex items-center" style={{ paddingLeft: `${(depth - 1) * 32}px` }}>
          <div className="flex items-center">
            {Array.from({ length: depth }).map((_, i) => (
              <div key={i} className="w-8 h-full flex items-center justify-center">
                <div className={`w-px h-full ${i === depth - 1 ? '' : ''}`} style={{ background: 'rgba(0, 240, 255, 0.2)' }} />
              </div>
            ))}
            <div className={`w-4 h-px`} style={{ background: 'rgba(0, 240, 255, 0.3)' }} />
            <span className="text-[10px] font-mono text-neon-cyan/60 ml-1">↳</span>
          </div>
        </div>
      )}

      <div
        className={`panel p-3 ml-${depth * 8} transition-all duration-300`}
        style={{ marginLeft: `${depth * 32 + (depth > 0 ? 16 : 0)}px` }}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-[10px] font-mono uppercase tracking-wider text-${accentColor}`}>
              {node?.type || 'Capsule'}
            </span>
            <span className={`font-mono text-xs text-${accentColor} truncate`}>
              {shortAssetId(node?.asset_id)}
            </span>
          </div>
          <span className={outcomeTag}>{outcome}</span>
        </div>

        <p className="text-xs font-mono text-ink leading-relaxed mb-2">
          {node?.summary || '(无摘要)'}
        </p>

        <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-mono">
          {node?.parent && (
            <span className="tag-dim">
              parent → {shortAssetId(node.parent)}
            </span>
          )}
          {node?.reused_asset_id && (
            <span className="tag-cyan">
              reused → {shortAssetId(node.reused_asset_id)}
            </span>
          )}
          {node?.confidence != null && (
            <span className="tag-amber">
              conf {Number(node.confidence).toFixed(2)}
            </span>
          )}
          {node?.source_type && (
            <span className="tag-violet">
              {node.source_type}
            </span>
          )}
        </div>
      </div>

      {node?.children?.length > 0 && (
        <div className="mt-2 space-y-2">
          {node.children.map((child, i) => (
            <ChainNode key={child?.asset_id || i} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * 能力链列表展示。
 * 轮询 GET /api/chain/:chainId，展示 chain_id 关联的所有资产（A → B → C）。
 */
export default function CapabilityChainList({ chainId = DEFAULT_CHAIN_ID }) {
  const [chain, setChain] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const timerRef = useRef(null)
  const { status } = useDemoStatus()

  const poll = async (signal) => {
    try {
      const res = await fetch(`/api/chain/${chainId}`, { signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setChain(data)
      setError(null)
      setLoading(false)
    } catch (e) {
      if (signal?.aborted) return
      setError(e.message)
      setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    poll(controller.signal)
    timerRef.current = setInterval(() => poll(controller.signal), 3000)
    return () => {
      controller.abort()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [chainId])

  useEffect(() => {
    if (status?.phase === 'done') {
      const controller = new AbortController()
      poll(controller.signal)
      return () => controller.abort()
    }
  }, [status?.phase])

  const assets = chain?.assets || []
  const tree = buildTree(assets)
  const totalAssets = assets.length

  // Demo 未到能力链查询阶段时显示占位
  if (!phaseReached(status?.phase, 'chain-earnings')) {
    return (
      <section className="panel">
        <div className="panel-header">
          <span className="panel-title">// 06 · 能力链生长</span>
          <span className="text-[10px] font-mono text-ink-dim">awaiting_chain_growth</span>
        </div>
        <div className="panel-body">
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-12 h-12 rounded-full border border-void-border flex items-center justify-center mb-3">
              <span className="text-ink-dim text-xl">·</span>
            </div>
            <p className="text-xs font-mono text-ink-dim">
              等待能力链生长...
            </p>
            <p className="text-[10px] font-mono text-ink-dim/60 mt-1">
              A → B → C 的溯源链路将在链尾阶段呈现
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
          <span className="panel-title">// 06 · 能力链生长</span>
          <span className="tag-magenta">CLIMAX</span>
        </div>
        <span className="text-[10px] font-mono text-ink-dim">
          chain_id: <span className="text-neon-cyan">{chainId}</span> · {totalAssets} assets
        </span>
      </div>

      <div className="panel-body">
        {/* 链头信息 */}
        <div className="panel bg-void-deep/60 p-2.5 mb-3 flex items-center gap-2 font-mono text-[11px] overflow-x-auto">
          <span className="text-neon-cyan shrink-0">GET</span>
          <span className="text-ink-muted shrink-0">/a2a/assets/chain/{chainId}</span>
          <span className="ml-auto text-ink-dim shrink-0">
            A failed → B success → C success
          </span>
        </div>

        {loading ? (
          <div className="text-center py-8 text-xs font-mono text-ink-dim animate-pulse">
            正在接入能力链...
          </div>
        ) : error && totalAssets === 0 ? (
          <div className="text-center py-8 text-xs font-mono text-ink-dim">
            等待 Demo 启动 · 能力链尚未生长
          </div>
        ) : tree.length === 0 ? (
          <div className="text-center py-8 text-xs font-mono text-ink-dim">
            等待 Demo 启动 · 能力链尚未生长
          </div>
        ) : (
          <div className="space-y-2" style={{ animation: 'fade-in 0.5s ease-out' }}>
            {tree.map((node, i) => (
              <ChainNode key={node?.asset_id || i} node={node} depth={0} />
            ))}
          </div>
        )}

        {/* 进度指示器 */}
        {totalAssets > 0 && (
          <div className="mt-4 flex items-center gap-2 text-[10px] font-mono">
            <span className="text-ink-dim">chain_growth:</span>
            <div className="flex-1 h-1 bg-void-raised rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-neon-red via-neon-amber to-neon-green transition-all duration-500"
                style={{ width: `${Math.min(100, (totalAssets / 3) * 100)}%` }}
              />
            </div>
            <span className="text-neon-cyan">{totalAssets}/3</span>
          </div>
        )}
      </div>
    </section>
  )
}
