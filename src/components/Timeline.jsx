import { useEffect, useState } from 'react'

// Instead of listing raw governed steps (llm_called, tool_call, …), show ONE
// friendly line that types itself out — "Thinking…", "Searching the web…",
// "Analysing…" — like a chat assistant working. The phrase is driven by the
// step the agent is currently on (read from the Temporal timeline), so it still
// reflects what's really happening; it's just shown in plain language.

const PHRASES = {
  setup: 'Getting started',
  llm_called: 'Thinking',
  web_search: 'Searching the web',
  tool_called: 'Working on it',
  synthesize: 'Analysing',
  complete: 'Wrapping up',
}

const TERMINAL = ['done', 'failed', 'blocked']

// Roughly how "done" each pipeline stage is — used to drive the live % so it
// reflects the step the agent is actually on (Thinking ≈ 30%, web search ≈ 55%,
// …) while still creeping up between updates so it always feels real-time.
const MILESTONES = {
  setup: 12,
  llm_called: 30,
  web_search: 55,
  tool_called: 72,
  synthesize: 88,
  complete: 96,
}

// The step the agent is currently on: the latest running/scheduled one, else the
// most recent step. Returns its kind (e.g. "web_search") or null when no steps.
function currentKind(items) {
  if (!items || items.length === 0) return null
  const inflight = [...items]
    .reverse()
    .find((it) => it.status === 'running' || it.status === 'scheduled')
  return (inflight || items[items.length - 1]).kind
}

// A live completion % that eases toward the current stage's milestone, then
// creeps slowly while the agent stays on that step — and snaps to 100 on done.
// It never moves backward, so progress only ever climbs.
function useProgress(active, kind, status) {
  const [pct, setPct] = useState(0)
  useEffect(() => {
    if (status === 'done') {
      setPct(100)
      return
    }
    if (!active) return
    const id = setInterval(() => {
      setPct((p) => {
        const target = (kind && MILESTONES[kind]) || 10
        if (p < target) return Math.min(target, p + Math.max(0.6, (target - p) * 0.16))
        return Math.min(95, p + 0.25) // still on this step → inch forward
      })
    }, 300)
    return () => clearInterval(id)
  }, [active, kind, status])
  return Math.round(pct)
}

// Typewriter: reveal `text` one character at a time while `animate` is true.
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
  const kind = currentKind(items)
  const phrase = (kind && PHRASES[kind]) || (active ? 'Thinking' : '')
  const typed = useTypewriter(phrase, active)
  const pct = useProgress(active, kind, status)

  if (!active) {
    if (status === 'done') return <div className="think done">✓ Done · 100%</div>
    if (status === 'failed') return <div className="think failed">✕ Couldn’t finish</div>
    if (status === 'blocked') return <div className="think failed">⛔ Blocked by the control plane</div>
    return <div className="think muted">Ready when you are.</div>
  }

  return (
    <div className="think" aria-live="polite">
      <span className="think-text">{typed}</span>
      <span className="think-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="think-pct mono">{pct}%</span>
    </div>
  )
}
