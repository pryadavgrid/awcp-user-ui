// Inline context-window indicator for the current chat — how much of the model
// context window this conversation has consumed and how much remains. Unlike the
// circular TokenRing (per-agent sliding-window BUDGET), this is per-CHAT context:
// Σ tokens across every turn of this chat vs AWCP_CONTEXT_WINDOW_TOKENS (default
// 128k), read from the gateway's /user/chat/history. Shown as a slim in-line bar
// (not a circle), like Claude's "context used / remaining".
//
// `ctx` is the gateway summary ({ enabled, used_tokens, context_window, used_pct,
// remaining_pct, remaining_tokens, turns }) or null. Renders nothing until there's
// a chat with data, so a brand-new/empty chat stays clean.
const fmtK = (n) => {
  n = Number(n || 0)
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k'
  return String(n)
}

export default function ContextBar({ ctx }) {
  if (!ctx || ctx.enabled === false) return null
  const used = ctx.used_tokens || 0
  const win = ctx.context_window || 0
  if (!win) return null
  const pct = Math.max(0, ctx.used_pct != null ? ctx.used_pct : (used * 100) / win)
  const cap = Math.min(100, pct)
  const left = ctx.remaining_pct != null ? ctx.remaining_pct : Math.max(0, 100 - pct)
  const state = pct >= 100 ? 'exhausted' : pct >= 80 ? 'warn' : 'ok'
  const turns = ctx.turn_count || 0
  const title =
    `Context window · this chat\n${used.toLocaleString()} / ${win.toLocaleString()} tokens ` +
    `(${pct}% used · ${left}% left)` + (turns ? ` · ${turns} turn${turns !== 1 ? 's' : ''}` : '')

  return (
    <div className={`ctxbar cx-${state}`} title={title}>
      <span className="cx-lbl">Context</span>
      <div className="cx-track">
        <i style={{ width: cap + '%' }} />
      </div>
      <span className="cx-nums mono">
        <b>{fmtK(used)}</b>/{fmtK(win)} · {left}% left
      </span>
    </div>
  )
}
