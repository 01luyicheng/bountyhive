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

export default function FailureMonologueCard({ capsules = [] }) {
  const { status } = useDemoStatus()

  if (!phaseReached(status?.phase, 'agent-a-ask-publish')) {
    return (
      <section className="panel">
        <div className="panel-header">
          <span className="panel-title">// Failed Attempts</span>
          <span className="text-[10px] font-mono text-ink-dim">awaiting_data</span>
        </div>
        <div className="panel-body">
          <div className="flex items-center justify-center py-10 text-center">
            <p className="text-xs font-mono text-ink-dim">
              No failed repair attempts recorded yet.
            </p>
          </div>
        </div>
      </section>
    )
  }

  const burnedCapsule = capsules.find(
    (c) => c?.asset_id?.includes('capsule_lesson_burned_001') || c?.id?.includes('capsule_lesson_burned_001')
  ) || capsules[0]

  if (!burnedCapsule) {
    return (
      <section className="panel">
        <div className="panel-header">
          <span className="panel-title">// Failed Attempts</span>
          <span className="text-[10px] font-mono text-ink-dim">awaiting_data</span>
        </div>
        <div className="panel-body">
          <div className="flex items-center justify-center py-10 text-center">
            <p className="text-xs font-mono text-ink-dim">
              No failed repair attempts recorded yet.
            </p>
          </div>
        </div>
      </section>
    )
  }

  const capsuleId = burnedCapsule.asset_id || burnedCapsule.id || 'unknown'
  const shortId = capsuleId.replace(/^sha256:/, '').slice(0, 32)
  const confidence = burnedCapsule.confidence ?? 0.6
  const model = burnedCapsule.model || burnedCapsule.llm_model || 'unknown'
  const validationErrors = burnedCapsule.validation_errors || burnedCapsule.errors || []
  const outcome = burnedCapsule.outcome || 'failed'
  const llmOutput = burnedCapsule.llm_output || burnedCapsule.output || burnedCapsule.raw_response || ''

  return (
    <section className="panel">
      <div className="panel-header">
        <span className="panel-title">// Failed Repair Attempt</span>
        <span className="tag-red text-[9px]">{outcome}</span>
      </div>

      <div className="panel-body space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          <div className="panel bg-void-deep/60 p-2.5">
            <div className="text-[9px] font-mono uppercase tracking-wider text-ink-dim">model</div>
            <div className="font-mono text-[11px] text-ink truncate" title={model}>
              {model}
            </div>
          </div>
          <div className="panel bg-void-deep/60 p-2.5">
            <div className="text-[9px] font-mono uppercase tracking-wider text-ink-dim">capsule_id</div>
            <div className="font-mono text-[10px] text-ink-muted truncate" title={capsuleId}>
              {shortId}
            </div>
          </div>
          <div className="panel bg-void-deep/60 p-2.5">
            <div className="text-[9px] font-mono uppercase tracking-wider text-ink-dim">confidence</div>
            <div className="font-display text-sm font-bold text-neon-amber">
              {Number(confidence).toFixed(2)}
            </div>
          </div>
          <div className="panel bg-void-deep/60 p-2.5">
            <div className="text-[9px] font-mono uppercase tracking-wider text-ink-dim">outcome</div>
            <div className="font-mono text-[11px] text-neon-red">
              {outcome}
            </div>
          </div>
          <div className="panel bg-void-deep/60 p-2.5">
            <div className="text-[9px] font-mono uppercase tracking-wider text-ink-dim">errors</div>
            <div className="font-mono text-[11px] text-neon-red/80">
              {Array.isArray(validationErrors) ? validationErrors.length : 0}
            </div>
          </div>
        </div>

        {Array.isArray(validationErrors) && validationErrors.length > 0 && (
          <div className="panel bg-void-deep/60 p-2.5">
            <div className="text-[9px] font-mono uppercase tracking-wider text-ink-dim mb-1.5">
              validation_errors
            </div>
            <div className="space-y-1">
              {validationErrors.map((err, i) => (
                <div key={i} className="text-[10px] font-mono text-neon-red/80 break-all">
                  {typeof err === 'string' ? err : JSON.stringify(err)}
                </div>
              ))}
            </div>
          </div>
        )}

        {llmOutput && (
          <div className="panel bg-void-deep/80 overflow-hidden">
            <div className="px-3 py-1.5 border-b border-void-border">
              <span className="text-[9px] font-mono uppercase tracking-wider text-ink-dim">
                llm_output
              </span>
            </div>
            <pre className="p-3 font-mono text-[10px] text-ink leading-relaxed overflow-x-auto whitespace-pre-wrap break-all max-h-[160px] overflow-y-auto">
              {String(llmOutput).slice(0, 200)}
              {String(llmOutput).length > 200 && '...'}
            </pre>
          </div>
        )}
      </div>
    </section>
  )
}
