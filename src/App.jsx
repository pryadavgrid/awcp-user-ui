import { useEffect, useRef, useState } from 'react'
import {
  API_BASE,
  listAgents,
  getUsage,
  getBudgets,
  getRegistryAgents,
  submitTask,
  uploadFile,
  getStatus,
  stopTask,
  getChatContext,
} from './api.js'
import Sidebar from './components/Sidebar.jsx'
import Composer from './components/Composer.jsx'
import ChatThread from './components/ChatThread.jsx'
import { PanelIcon } from './components/icons.jsx'
import logoUrl from './img/awcp_user_ui_logo.png'

const TERMINAL = new Set(['done', 'failed', 'blocked', 'canceled'])
const STORE_KEY = 'awcp.chats.v1'
const MAX_FILE_CHARS = 20000 // cap per-file text we inline into a prompt

// ── token budget resolution (same precedence laminar uses) ───────────────────
function resolveBudget(entry, budgets) {
  if (!entry) return 0
  const ov = (budgets.overrides || {})[entry.id]
  if (ov && ov > 0) return ov
  if (entry.token_budget && entry.token_budget > 0) return entry.token_budget
  const tier = (budgets.risk_defaults || {})[entry.risk]
  return tier || budgets.system_default || 0
}

// The token-ring view for the selected agent: a live usage row, or its resolved
// budget (0 used) if registered but unspent, or a "not started" placeholder.
function tokenInfoFor(selected, usage, regAgents, budgets) {
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

const uid = () => Math.random().toString(36).slice(2, 10)
const titleFrom = (text) => {
  const t = (text || '').trim().replace(/\s+/g, ' ')
  return t ? (t.length > 42 ? t.slice(0, 42) + '…' : t) : 'New chat'
}

function loadChats() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export default function App() {
  // dynamic backend data
  const [agents, setAgents] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [usage, setUsage] = useState([])
  const [budgets, setBudgets] = useState({})
  const [regAgents, setRegAgents] = useState([])
  const [backendOk, setBackendOk] = useState(null)

  // conversation state (persisted)
  const [chats, setChats] = useState(loadChats)
  const [activeChatId, setActiveChatId] = useState(() => {
    const c = loadChats()
    return c[0] ? c[0].id : null
  })

  // composer state
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState([])
  const [busy, setBusy] = useState(false)
  // Sidebar visibility is a plain toggle (menu button shows/hides it on every
  // screen). Default: open on desktop, collapsed on narrow screens where it
  // slides in as a drawer.
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth > 860,
  )

  // the task currently being polled → which message it writes into
  const [activeTask, setActiveTask] = useState(null)
  const activeTaskRef = useRef(null)
  activeTaskRef.current = activeTask

  // Per-chat context-window meter (Σ tokens for this chat vs the model window),
  // read from the gateway keyed on the chat id (= session id).
  const [contextInfo, setContextInfo] = useState(null)

  const selected = agents.find((a) => a.id === selectedId) || null
  const currentChat = chats.find((c) => c.id === activeChatId) || null
  const messages = currentChat ? currentChat.messages : []
  const running = !!activeTask
  const tokenInfo = tokenInfoFor(selected, usage, regAgents, budgets)
  const showHero = !currentChat || messages.length === 0

  // persist conversations
  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(chats))
    } catch {
      /* storage full / disabled — history is best-effort */
    }
  }, [chats])

  // ── load + refresh agents / token policy ───────────────────────────────────
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const a = await listAgents()
        if (!alive) return
        setAgents(a)
        setBackendOk(true)
        setSelectedId((prev) => prev || (a[0] && a[0].id) || '')
      } catch {
        if (alive) setBackendOk(false)
      }
      const [u, b, ra] = await Promise.all([
        getUsage().catch(() => null),
        getBudgets().catch(() => null),
        getRegistryAgents().catch(() => null),
      ])
      if (!alive) return
      if (u) setUsage(u)
      if (b) setBudgets(b)
      if (ra) setRegAgents(ra)
    }
    load()
    const t = setInterval(load, 5000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  // ── patch one assistant message's run state inside a chat ───────────────────
  const patchRun = (chatId, msgId, patch) => {
    setChats((prev) =>
      prev.map((c) =>
        c.id !== chatId
          ? c
          : {
              ...c,
              messages: c.messages.map((m) =>
                m.id !== msgId ? m : { ...m, run: { ...(m.run || {}), ...patch } },
              ),
            },
      ),
    )
  }

  // ── poll the active task and stream its state into its message ──────────────
  useEffect(() => {
    if (!activeTask) return
    let alive = true
    let timer
    const poll = async () => {
      try {
        const s = await getStatus(activeTask.agent, activeTask.task_id, activeTask.workflow_id)
        if (!alive) return
        patchRun(activeTask.chatId, activeTask.msgId, s)
        getUsage().then((u) => alive && u && setUsage(u)).catch(() => {})
        if (TERMINAL.has(s.status)) {
          setActiveTask(null)
          // The turn was just persisted — refresh the context meter now instead
          // of waiting for the next 4s tick.
          getChatContext(activeTask.chatId)
            .then((c) => alive && setContextInfo(c && c.enabled === false ? null : c))
            .catch(() => {})
          return
        }
      } catch {
        /* transient — keep trying */
      }
      if (alive) timer = setTimeout(poll, 1200)
    }
    poll()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [activeTask])

  // ── per-chat context-window meter ───────────────────────────────────────────
  // Poll the gateway for this chat's Σ tokens vs the model window. Keyed on the
  // chat id (= session id); reset when no chat is open. The 4s tick catches the
  // update after each turn is persisted.
  useEffect(() => {
    if (!activeChatId) {
      setContextInfo(null)
      return
    }
    let alive = true
    const tick = () =>
      getChatContext(activeChatId)
        .then((c) => alive && setContextInfo(c && c.enabled === false ? null : c))
        .catch(() => {})
    tick()
    const t = setInterval(tick, 4000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [activeChatId])

  // ── file attachments ────────────────────────────────────────────────────────
  const onAddFiles = async (fileList) => {
    const files = Array.from(fileList || [])
    const read = await Promise.all(
      files.map(async (f) => {
        const isText =
          f.type.startsWith('text/') ||
          /\.(txt|md|json|csv|ya?ml|js|jsx|ts|tsx|py|html?|css|log|xml|toml|ini|sh)$/i.test(f.name)
        // Inline readable text so text-only agents (LangGraph/CrewAI) still see
        // the content — they can't open a path. Best-effort.
        let content = null
        if (isText) {
          content = await new Promise((resolve) => {
            const r = new FileReader()
            r.onload = () => resolve(String(r.result || '').slice(0, MAX_FILE_CHARS))
            r.onerror = () => resolve(null)
            r.readAsText(f)
          })
        }
        // Upload the real bytes so file-aware agents (File Inspector) can open the
        // file by path — this is what makes images / PDFs / binaries work.
        let path = null
        try {
          path = (await uploadFile(f)).path
        } catch {
          path = null
        }
        return { id: uid(), name: f.name, size: f.size, content, path }
      }),
    )
    setAttachments((prev) => [...prev, ...read])
  }
  const onRemoveAttachment = (id) => setAttachments((prev) => prev.filter((f) => f.id !== id))

  // Compose the prompt actually sent to the agent: inline any readable text
  // files (so attachments are functional even though the gateway takes plain
  // text), then the user's message.
  const buildInput = (text, atts) => {
    const parts = []
    // 1) inline readable text so text-only agents see the content
    for (const f of atts) {
      if (f.content) parts.push(`--- attached file: ${f.name} ---\n${f.content}`)
    }
    // 2) name-only note for files we could neither read nor upload
    const orphan = atts.filter((f) => !f.content && !f.path).map((f) => f.name)
    if (orphan.length) parts.push(`[attached files: ${orphan.join(', ')}]`)
    // 3) the user's message
    if (text) parts.push(text)
    // 4) real local paths LAST: a file-aware agent (File Inspector) opens the
    //    bytes from FILE_PATH and treats the text BEFORE it as the request, so
    //    these must trail the message to keep the user's question intact.
    for (const f of atts) {
      if (f.path) parts.push(`FILE_PATH: ${f.path}`)
    }
    return parts.join('\n\n')
  }

  // On narrow screens the sidebar is a drawer — auto-close it after a chat
  // action. On desktop it stays put (it's a persistent collapsible panel).
  const closeSidebarOnMobile = () => {
    if (typeof window !== 'undefined' && window.innerWidth <= 860) setSidebarOpen(false)
  }

  // ── chat actions ─────────────────────────────────────────────────────────────
  const onNewChat = () => {
    setActiveChatId(null)
    setInput('')
    setAttachments([])
    closeSidebarOnMobile()
  }

  const onSelectChat = (id) => {
    setActiveChatId(id)
    closeSidebarOnMobile()
  }

  const onDeleteChat = (id) => {
    setChats((prev) => prev.filter((c) => c.id !== id))
    if (activeChatId === id) setActiveChatId(null)
  }

  const onSend = async () => {
    const text = input.trim()
    if (!selectedId || (!text && attachments.length === 0) || busy || running) return

    const atts = attachments
    const userMsg = { id: uid(), role: 'user', text, attachments: atts }
    const asstMsg = { id: uid(), role: 'assistant', run: { status: 'queued' } }
    const title = titleFrom(text || (atts[0] && atts[0].name))

    // Decide the target chat id NOW (synchronously) — never inside the setChats
    // updater, which React runs later. Otherwise setActiveChatId() below would
    // get the stale id and the new chat would land in history but not open in
    // the current window. Reuse the open chat, or mint a new one on first send.
    const existing = activeChatId && chats.some((c) => c.id === activeChatId)
    const chatId = existing ? activeChatId : uid()

    setChats((prev) => {
      if (existing) {
        return prev.map((c) =>
          c.id !== chatId
            ? c
            : {
                ...c,
                title: c.messages.length === 0 ? title : c.title,
                messages: [...c.messages, userMsg, asstMsg],
              },
        )
      }
      const chat = { id: chatId, title, createdAt: Date.now(), messages: [userMsg, asstMsg] }
      return [chat, ...prev]
    })
    setActiveChatId(chatId)
    setInput('')
    setAttachments([])
    setBusy(true)

    try {
      // The chat id doubles as the session id — this is what gives the agent
      // per-chat context memory (it reads prior turns of this session) and keeps
      // the run history + context-window meter grouped by conversation.
      const t = await submitTask(selectedId, buildInput(text, atts), chatId)
      patchRun(chatId, asstMsg.id, {
        status: t.status || 'queued',
        temporal_url: t.temporal_url,
        timeline: [],
      })
      setActiveTask({
        chatId,
        msgId: asstMsg.id,
        agent: t.agent,
        task_id: t.task_id,
        workflow_id: t.workflow_id,
      })
    } catch (e) {
      patchRun(chatId, asstMsg.id, { status: 'failed', error: String(e.message || e) })
    } finally {
      setBusy(false)
    }
  }

  // Operator approval of high-risk writes is handled in the AWCP control-plane
  // UI (the Approvals panel), NOT here — the end user never approves from chat.

  // ── stop the in-flight task mid-run ─────────────────────────────────────────
  // Cancels the Temporal workflow (gateway → saved on Temporal) and tells the
  // agent to stop, then settles this message locally and frees the composer.
  const onStop = async () => {
    const at = activeTaskRef.current
    if (!at) return
    setActiveTask(null) // stop the main poll immediately so the composer frees up
    patchRun(at.chatId, at.msgId, { status: 'canceled', stopped: true })
    try {
      await stopTask(at.agent, at.task_id, at.workflow_id)
    } catch (e) {
      // The run is already stopped client-side; surface a soft note only.
      patchRun(at.chatId, at.msgId, {
        status: 'canceled',
        stopped: true,
        error: `Stopped (cancel request error: ${String(e.message || e)})`,
      })
    }

    // The in-flight LLM call can't be force-killed, so the agent settles the run
    // as canceled WITH whatever output it produced (Temporal shows it too). Poll a
    // few times to capture that output and merge it into this message — keeping the
    // Stopped state — so the user sees the result instead of an empty "Stopped".
    let tries = 0
    const grab = async () => {
      tries += 1
      try {
        const s = await getStatus(at.agent, at.task_id, at.workflow_id)
        if (s && s.result) {
          patchRun(at.chatId, at.msgId, {
            status: 'canceled',
            stopped: true,
            result: s.result,
            timeline: s.timeline,
            temporal_url: s.temporal_url,
          })
          getChatContext(at.chatId).then((c) => setContextInfo(c && c.enabled === false ? null : c)).catch(() => {})
          return // got the output — done
        }
      } catch {
        /* transient — keep trying */
      }
      if (tries < 12) setTimeout(grab, 1500)
    }
    setTimeout(grab, 1000)
  }

  return (
    <div className="layout">
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        onNewChat={onNewChat}
        onSelectChat={onSelectChat}
        onDeleteChat={onDeleteChat}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((o) => !o)}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="workspace">
        <header className="topbar">
          <button
            type="button"
            className="hamburger"
            aria-label="Toggle sidebar"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen((o) => !o)}
          >
            <PanelIcon />
          </button>
          <span className="tb-title">AWCP User Interface</span>
          <span className="conn">
            <span className={`dot ${backendOk ? 'on' : backendOk === false ? 'off' : ''}`} />
            <span className="mono conn-url">{API_BASE}</span>
          </span>
        </header>

        {showHero ? (
          <div className="hero-wrap">
            <img className="hero-logo" src={logoUrl} alt="Agent Interface" />
            <div className="hero-composer">
              <Composer
                input={input}
                setInput={setInput}
                onSend={onSend}
                onStop={onStop}
                agents={agents}
                selectedId={selectedId}
                onSelectAgent={setSelectedId}
                tokenInfo={tokenInfo}
                attachments={attachments}
                onAddFiles={onAddFiles}
                onRemoveAttachment={onRemoveAttachment}
                busy={busy}
                running={running}
                disabled={backendOk === false}
                contextInfo={contextInfo}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="thread-scroll">
              <ChatThread messages={messages} />
            </div>
            <div className="composer-dock">
              <Composer
                input={input}
                setInput={setInput}
                onSend={onSend}
                onStop={onStop}
                agents={agents}
                selectedId={selectedId}
                onSelectAgent={setSelectedId}
                tokenInfo={tokenInfo}
                attachments={attachments}
                onAddFiles={onAddFiles}
                onRemoveAttachment={onRemoveAttachment}
                busy={busy}
                running={running}
                disabled={backendOk === false}
                contextInfo={contextInfo}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
