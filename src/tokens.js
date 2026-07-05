// Token budget/usage resolution shared by the composer's token ring and the
// settings panel's per-agent list. Kept generic — it never names an agent; the
// budget precedence mirrors what laminar uses on the gateway.

// Resolve an agent's token budget from the policy: explicit override → the
// agent's declared token_budget → its risk-tier default → the system default.
export function resolveBudget(entry, budgets) {
  if (!entry) return 0
  const ov = (budgets.overrides || {})[entry.id]
  if (ov && ov > 0) return ov
  if (entry.token_budget && entry.token_budget > 0) return entry.token_budget
  const tier = (budgets.risk_defaults || {})[entry.risk]
  return tier || budgets.system_default || 0
}

// The token view for one agent: a live usage row if it has already spent tokens,
// otherwise its resolved budget with 0 used. `pending` marks agents we can't key
// yet (no agent_id). `selected` is an agent object from listAgents().
export function tokenInfoFor(selected, usage, regAgents, budgets) {
  if (!selected) return { info: null, pending: true }
  const aid = selected.agent_id
  if (!aid) return { info: null, pending: true }
  const row = usage.find((u) => u.agent_id && u.agent_id === aid)
  if (row && row.budget) return { info: row, pending: false }
  const entry = regAgents.find((r) => r.id === aid)
  const budget = entry ? resolveBudget(entry, budgets) : budgets.system_default || 0
  return {
    info: {
      agent_id: aid,
      budget: { used_tokens: 0, budget_tokens: budget, ratio: 0, state: 'ok' },
      window: { total_tokens: 0, calls: 0 },
    },
    pending: false,
  }
}
