import { md } from '../md.js'
import ExportMenu from './ExportMenu.jsx'

// Final answer + a deep link into Temporal. All fields are whatever the agent
// returned. (Tools used / governed-writes details are intentionally not shown.)
export default function ResultPanel({ status, title }) {
  if (!status) return null
  const {
    result, temporal_url, error, status: s, blocked, stopped,
    blocked_reason, blocked_title, write_blocked, write_blocked_reason,
  } = status
  const isBlocked = s === 'blocked' || blocked
  const isStopped = s === 'canceled' || stopped

  // Note: operator approval of high-risk writes is intentionally NOT shown here.
  // It is an OPERATOR action handled in the AWCP control-plane UI (the Approvals
  // panel). The end user just sees the run continue once the operator approves.
  return (
    <div className="result-panel">
      {isStopped ? (
        // The user stopped this run — the gateway cancelled its Temporal workflow.
        // The agent still settles with whatever output it produced, so show that
        // below the notice (Temporal shows it too) rather than hiding it.
        <>
          <div className="blocked-msg">
            <div className="blocked-title">■ Stopped</div>
            <div className="blocked-reason">
              {error || 'You stopped this run. Its workflow was cancelled in Temporal.'}
            </div>
          </div>
          {result && (
            <div className="result" dangerouslySetInnerHTML={{ __html: md(result) }} />
          )}
        </>
      ) : isBlocked ? (
        // The control plane blocked this task — show the ACCURATE source/reason
        // (token budget vs agent-hooks vs other), never a hardcoded one.
        <div className="blocked-msg">
          <div className="blocked-title">{blocked_title || '⛔ Blocked by the Control Plane'}</div>
          <div className="blocked-reason">
            {blocked_reason || error ||
              'An action this task needed was denied by the control plane, so no answer was produced.'}
          </div>
        </div>
      ) : (
        <>
          {error && <div className="err">{error}</div>}
          {/* The answer is valid; only a write side-effect (save/post) was blocked
              by the control plane (e.g. the agent is quarantined). Non-fatal note. */}
          {write_blocked && (
            <div className="blocked-msg" style={{ marginBottom: 12 }}>
              <div className="blocked-title">⚠ Write blocked — answer still shown</div>
              <div className="blocked-reason">
                {write_blocked_reason ||
                  'The control plane blocked a write action (saving/posting the result), but the answer was produced.'}
              </div>
            </div>
          )}
          {result ? (
            <div className="result" dangerouslySetInnerHTML={{ __html: md(result) }} />
          ) : (
            <div className="muted">No result yet — it appears here when the agent finishes.</div>
          )}
        </>
      )}

      {(result || temporal_url) && (
        <div className="result-actions">
          <ExportMenu result={result} title={title} />
          {temporal_url && (
            <a className="tlink" href={temporal_url} target="_blank" rel="noreferrer">
              Open this run in Temporal ↗
            </a>
          )}
        </div>
      )}
    </div>
  )
}
