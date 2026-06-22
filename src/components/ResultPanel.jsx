import { md } from '../md.js'
import ExportMenu from './ExportMenu.jsx'

// Final answer + a deep link into Temporal. All fields are whatever the agent
// returned. (Tools used / governed-writes details are intentionally not shown.)
export default function ResultPanel({ status, onApprove, title }) {
  if (!status) return null
  const { result, temporal_url, error, awaiting, status: s, blocked, blocked_reason, blocked_title } = status
  const isBlocked = s === 'blocked' || blocked

  return (
    <div className="result-panel">
      {awaiting && s === 'awaiting_approval' && (
        <div className="approve">
          <span className="q">
            ⚠ Approval required: high-risk <b>{awaiting.action}</b>
            {awaiting.detail ? ` — ${awaiting.detail}` : ''}
          </span>
          <button className="btn ok" onClick={() => onApprove('approve')}>
            Approve
          </button>
          <button className="btn danger" onClick={() => onApprove('deny')}>
            Deny
          </button>
        </div>
      )}

      {isBlocked ? (
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
