// Thin client for the AWCP gateway. Everything here is generic — it never names
// an agent or a tool; the agent list, examples, tools and timeline all come from
// the gateway at runtime, so the UI works for any agent the backend exposes.

const API = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

async function call(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) {
    const detail = data && data.detail !== undefined ? data.detail : data
    const msg = typeof detail === 'string' ? detail : JSON.stringify(detail)
    throw new Error(msg || `HTTP ${res.status}`)
  }
  return data
}

export const API_BASE = API

export const listAgents = () => call('GET', '/user/agents')

// Per-agent token usage + budget (the token monitor feed). Optional: returns []
// when the laminar module isn't mounted or no agent has reported usage yet — so
// it only lists agents that have ALREADY spent tokens. To show a budget bar for
// every agent (incl. ones that haven't spent yet) we also read the budget policy
// + the registry below and resolve each agent's budget client-side.
export const getUsage = () => call('GET', '/laminar/usage')

// Live token policy: { overrides, risk_defaults (tiers), system_default, window_s }.
export const getBudgets = () => call('GET', '/laminar/budgets')

// The radar registry — every governed agent with its risk tier + declared
// token_budget, keyed by the same id the agent reports as `agent_id`.
export const getRegistryAgents = () => call('GET', '/agents')

// Upload an attached file to the gateway. Returns { path, name, size } — the
// `path` is a gateway-local path the UI hands to file-aware agents (File
// Inspector) via a `FILE_PATH:` token, so the agent opens the real bytes.
export const uploadFile = async (file) => {
  const fd = new FormData()
  fd.append('file', file, file.name)
  const res = await fetch(`${API}/user/upload`, { method: 'POST', body: fd })
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) {
    const detail = data && data.detail !== undefined ? data.detail : data
    throw new Error((typeof detail === 'string' ? detail : JSON.stringify(detail)) || `HTTP ${res.status}`)
  }
  return data
}

export const submitTask = (agent, input) =>
  call('POST', '/user/submit', { agent, input })

export const getStatus = (agent, taskId, workflowId) =>
  call(
    'GET',
    `/user/status/${encodeURIComponent(agent)}/${encodeURIComponent(taskId)}` +
      (workflowId ? `?workflow_id=${encodeURIComponent(workflowId)}` : ''),
  )

export const approveTask = (agent, taskId, decision) =>
  call(
    'POST',
    `/user/approve/${encodeURIComponent(agent)}/${encodeURIComponent(taskId)}`,
    { decision },
  )

// Stop a running task mid-execution. The gateway cancels its Temporal workflow
// (recorded in Temporal history) and tells the agent to stop. workflowId is the
// dynamic id from submit — passed through so nothing is reconstructed/hardcoded.
export const stopTask = (agent, taskId, workflowId) =>
  call(
    'POST',
    `/user/stop/${encodeURIComponent(agent)}/${encodeURIComponent(taskId)}` +
      (workflowId ? `?workflow_id=${encodeURIComponent(workflowId)}` : ''),
  )
