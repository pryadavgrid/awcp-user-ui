import { useEffect, useState } from 'react'

// Instead of a raw list of governed steps (llm_called, tool_call, …) or a fake
// percentage, show ONE plain-language line that says what the agent is REALLY
// doing right now — "Searching the web", "Waiting for approval", "Generating the
// final answer". The line is driven by the step the agent is currently on (read
// from the Temporal timeline) and the run's own status, so it always reflects
// reality; we just phrase it for a person and skip the noise of every tool call.

const PHRASES = {
  setup: 'Getting started',
  llm_called: 'Thinking',
  web_search: 'Searching the web',
  tool_called: 'Working on it',
  synthesize: 'Generating the final answer',
  complete: 'Finishing up',
}

// Run-level states that mean "no longer working" — everything else is live.
const TERMINAL = ['done', 'failed', 'blocked']

// The step the agent is currently on: the latest running/scheduled one, else the
// most recent step. Returns its kind (e.g. "web_search") or null when no steps.
function currentKind(items) {
  if (!items || items.length === 0) return null
  const inflight = [...items]
    .reverse()
    .find((it) => it.status === 'running' || it.status === 'scheduled')
  return (inflight || items[items.length - 1]).kind
}

// Turn the run status + current step into the single friendly phrase to show.
// A run-level state the user cares about (waiting on an approval) wins over
// whatever tool step happens to be in flight.
function phraseFor(status, items) {
  if (status === 'awaiting_approval') return 'Waiting for approval'
  const kind = currentKind(items)
  if (kind && PHRASES[kind]) return PHRASES[kind]
  // No steps yet (queued/pending) or an unknown tool → stay high-level on
  // purpose. We never surface raw tool names — just that it's actively working.
  return items && items.length ? 'Working on it' : 'Getting started'
}

// Typewriter: reveal `text` one character at a time while `animate` is true, and
// re-type whenever the phrase changes — so each new stage visibly "arrives".
function useTypewriter(text, animate) {
  const [shown, setShown] = useState(animate ? '' : text)
  useEffect(() => {
    if (!animate) {
      setShown(text)
      return
    }
    setShown('')
    let i = 0
    const id = setInterval(() => {
      i += 1
      setShown(text.slice(0, i))
      if (i >= text.length) clearInterval(id)
    }, 45)
    return () => clearInterval(id)
  }, [text, animate])
  return shown
}

export default function Timeline({ items, status }) {
  const active = status && !TERMINAL.includes(status)
  const waiting = status === 'awaiting_approval'
  const phrase = active ? phraseFor(status, items) : ''
  const typed = useTypewriter(phrase, active)

  if (!active) {
    if (status === 'done') return <div className="think done">✓ Done</div>
    if (status === 'failed') return <div className="think failed">✕ Couldn’t finish</div>
    if (status === 'blocked') return <div className="think failed">⛔ Blocked by the control plane</div>
    return <div className="think muted">Ready when you are.</div>
  }

  return (
    <div className={`think${waiting ? ' waiting' : ''}`} aria-live="polite">
      <span className="think-text">{typed}</span>
      <span className="think-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </div>
  )
}
