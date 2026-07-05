import { useEffect } from 'react'
import { tokenInfoFor } from '../tokens.js'

// Settings modal. One section for now — "Agents" — showing, per agent:
//   • its token usage: used / budget, remaining, and a usage bar,
//   • a running toggle that starts/stops the agent via the gateway.
// Token figures come from the same budget resolution the composer's ring uses, so
// they match. All data is passed in (no fetching here) — the parent already polls
// usage + the agent list every few seconds, so this stays live while open.
const fmt = (n) => Number(n || 0).toLocaleString()

export default function SettingsPanel({
  open,
  onClose,
  agents,
  usage,
  regAgents,
  budgets,
  onToggleAgent,
  togglingId,
  toggleError,
  backendOk,
}) {
  // Close on Escape while open.
  useEffect(() => {
    if (!open) return
    const onEsc = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="settings-scrim" onClick={onClose}>
      <div className="settings-modal" role="dialog" aria-modal="true" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <div className="settings-head">
          <span className="settings-title">Settings</span>
          <button type="button" className="settings-close" onClick={onClose} aria-label="Close settings">×</button>
        </div>

        <div className="settings-body">
          <section className="settings-section">
            <div className="ss-head">
              <h3 className="ss-title">Agents</h3>
              <span className="ss-sub">Token usage & start / stop</span>
            </div>

            {backendOk === false && (
              <div className="ss-note">Can’t reach the gateway — agent controls are unavailable until it reconnects.</div>
            )}
            {agents.length === 0 && backendOk !== false && (
              <div className="ss-note">No agents found.</div>
            )}
            {toggleError && <div className="ss-note err-note">{toggleError}</div>}

            <div className="agent-rows">
              {agents.map((a) => {
                const { info } = tokenInfoFor(a, usage, regAgents, budgets)
                const budget = (info && info.budget) || { used_tokens: 0, budget_tokens: 0, ratio: 0 }
                const used = budget.used_tokens || 0
                const total = budget.budget_tokens || 0
                const remaining = Math.max(0, total - used)
                const ratio = total > 0 ? Math.min(1, used / total) : 0
                const pct = Math.round(ratio * 100)
                const barState = ratio >= 1 ? 'exhausted' : ratio >= 0.8 ? 'warn' : 'ok'
                const sub = [a.framework, a.model].filter(Boolean).join(' · ')
                const busy = togglingId === a.id
                const running = !!a.running
                return (
                  <div className="agent-row" key={a.id}>
                    <div className="ar-main">
                      <div className="ar-top">
                        <span className={`ar-dot ${running ? 'on' : ''}`} />
                        <span className="ar-name">{a.name || a.id}</span>
                        {sub && <span className="ar-sub">{sub}</span>}
                        <span className={`ar-state ${running ? 'running' : 'stopped'}`}>
                          {running ? 'Running' : 'Stopped'}
                        </span>
                      </div>

                      <div className={`ar-meter tok-${barState}`}>
                        <div className="ar-track"><i style={{ width: `${pct}%` }} /></div>
                      </div>

                      <div className="ar-nums">
                        <span>Used <b>{fmt(used)}</b>{total > 0 && <> / {fmt(total)}</>}</span>
                        <span className="ar-remain">
                          {total > 0 ? <>Remaining <b>{fmt(remaining)}</b></> : 'No budget set'}
                        </span>
                      </div>
                    </div>

                    {/* Start/stop toggle — flips the agent via the gateway. */}
                    <button
                      type="button"
                      className={`switch ${running ? 'on' : ''}`}
                      role="switch"
                      aria-checked={running}
                      aria-label={running ? `Stop ${a.name || a.id}` : `Start ${a.name || a.id}`}
                      title={running ? 'Stop agent' : 'Start agent'}
                      disabled={busy || backendOk === false}
                      onClick={() => onToggleAgent(a.id)}
                    >
                      <span className="switch-knob">{busy && <span className="spinner sm" />}</span>
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
