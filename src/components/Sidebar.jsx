import { useEffect, useRef, useState } from 'react'
import { ComposeIcon, SearchIcon, ChatIcon, PanelIcon } from './icons.jsx'

// Left sidebar — two visual modes, ChatGPT-style:
//   • expanded  → "AWCP", a search box, "New chat", and the conversation history,
//   • collapsed → a thin icon rail (AWCP · new chat · search · chats).
// `open` drives the mode; on desktop it slides between rail and full width, on
// narrow screens the full panel slides in as a drawer over a scrim.
export default function Sidebar({
  chats,
  activeChatId,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  open,
  onToggle,
  onClose,
}) {
  const [query, setQuery] = useState('')
  const [focusOnOpen, setFocusOnOpen] = useState(false)
  const searchRef = useRef(null)

  // Clicking the rail's search icon expands the panel and lands in the box.
  const onRailSearch = () => {
    if (!open) onToggle()
    setFocusOnOpen(true)
  }
  useEffect(() => {
    if (open && focusOnOpen && searchRef.current) {
      searchRef.current.focus()
      setFocusOnOpen(false)
    }
  }, [open, focusOnOpen])

  // Filter history by chat title or any message text (case-insensitive).
  const q = query.trim().toLowerCase()
  const filtered = q
    ? chats.filter(
        (c) =>
          (c.title || '').toLowerCase().includes(q) ||
          (c.messages || []).some((m) => (m.text || '').toLowerCase().includes(q)),
      )
    : chats

  return (
    <>
      <div className={`scrim ${open ? 'show' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${open ? 'open' : 'collapsed'}`}>
        {/* Collapsed icon rail (desktop only) */}
        <div className="sb-rail">
          <button type="button" className="rail-btn brand" onClick={onToggle} title="Open sidebar" aria-label="Open sidebar">
            AWCP
          </button>
          <button type="button" className="rail-btn" onClick={onNewChat} title="New chat" aria-label="New chat">
            <ComposeIcon />
          </button>
          <button type="button" className="rail-btn" onClick={onRailSearch} title="Search chats" aria-label="Search chats">
            <SearchIcon />
          </button>
          <button type="button" className="rail-btn" onClick={onToggle} title="Chats" aria-label="Chats">
            <ChatIcon />
          </button>
        </div>

        {/* Expanded full panel */}
        <div className="sb-full">
          <div className="sb-head">
            <span className="sb-title">AWCP</span>
            <button type="button" className="sb-collapse" onClick={onToggle} title="Collapse sidebar" aria-label="Collapse sidebar">
              <PanelIcon />
            </button>
          </div>

          <div className="sb-search">
            <SearchIcon className="sb-search-ic" />
            <input
              ref={searchRef}
              className="sb-search-input"
              type="text"
              placeholder="Search chats"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button type="button" className="sb-search-clear" onClick={() => setQuery('')} aria-label="Clear search">
                ×
              </button>
            )}
          </div>

          <button type="button" className="new-chat" onClick={onNewChat}>
            <span className="nc-plus">+</span> New chat
          </button>

          <div className="sb-section">Recents</div>
          <div className="history">
            {chats.length === 0 && <div className="hist-empty">No conversations yet</div>}
            {chats.length > 0 && filtered.length === 0 && (
              <div className="hist-empty">No chats match “{query.trim()}”</div>
            )}
            {filtered.map((c) => (
              <div
                key={c.id}
                className={`hist-item ${c.id === activeChatId ? 'active' : ''}`}
                onClick={() => onSelectChat(c.id)}
                title={c.title || 'New chat'}
              >
                <span className="hist-title">{c.title || 'New chat'}</span>
                <button
                  type="button"
                  className="hist-del"
                  aria-label="Delete conversation"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteChat(c.id)
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </>
  )
}
