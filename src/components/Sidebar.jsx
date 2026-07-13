import { useEffect, useRef, useState } from 'react'
import { SearchIcon, PanelIcon, PlusIcon, ComposeIcon, GearIcon, CATEGORY_ICONS } from './icons.jsx'
import { CATEGORIES, OTHER, categorize, relativeTime } from '../categorize.js'

// Left sidebar — two columns, ChatGPT-style:
//   • a thin category icon rail (always visible): brand, an "All chats" icon and
//     one icon per topic that currently has chats (Traveling, Coding, …) — the
//     topics are DERIVED from chat text (see categorize.js), so a section appears
//     on its own as soon as a matching chat exists,
//   • the chat panel: "Chats (N)" header, search, and the conversation list.
// Selecting "All" groups the list into topic sections; selecting a topic icon
// filters the list to just that topic. Agent selection is unrelated — it lives
// in the composer, so the rail never touches it.
export default function Sidebar({
  chats,
  activeChatId,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  activeCat,
  onSelectCategory,
  onOpenSettings,
  open,
  onToggle,
  onClose,
}) {
  const [query, setQuery] = useState('')
  const [focusOnOpen, setFocusOnOpen] = useState(false)
  const searchRef = useRef(null)

  useEffect(() => {
    if (open && focusOnOpen && searchRef.current) {
      searchRef.current.focus()
      setFocusOnOpen(false)
    }
  }, [open, focusOnOpen])

  // Tag each chat with its derived topic, a one-line preview and a timestamp.
  const tagged = chats.map((c) => {
    const msgs = c.messages || []
    const last = [...msgs].reverse().find((m) => (m.text || '').trim())
    const preview = ((last && last.text) || '').replace(/\s+/g, ' ').trim()
    return { chat: c, cat: categorize(c), preview, ts: c.createdAt || 0 }
  })

  // Rail order: "All", then only the topics that actually have chats (in the
  // canonical CATEGORIES order), then "General" last if anything landed there.
  const presentIds = new Set(tagged.map((t) => t.cat.id))
  const railCats = [
    ...CATEGORIES.filter((c) => presentIds.has(c.id)),
    ...(presentIds.has(OTHER.id) ? [OTHER] : []),
  ]

  // Search across title + message text, then narrow to the selected topic.
  const q = query.trim().toLowerCase()
  const searched = q
    ? tagged.filter(
        (t) =>
          (t.chat.title || '').toLowerCase().includes(q) ||
          (t.chat.messages || []).some((m) => (m.text || '').toLowerCase().includes(q)),
      )
    : tagged
  const visible = activeCat === 'all' ? searched : searched.filter((t) => t.cat.id === activeCat)

  // In the "All" view the list is grouped into topic sections; a specific topic
  // shows a flat list (no redundant single header).
  const groups =
    activeCat === 'all'
      ? [...CATEGORIES, OTHER]
          .map((cat) => ({ cat, items: visible.filter((t) => t.cat.id === cat.id) }))
          .filter((g) => g.items.length > 0)
      : [{ cat: null, items: visible }]

  const pickCat = (id) => {
    onSelectCategory(id)
    if (!open) onToggle() // opening the panel when a topic is tapped from a collapsed rail
  }

  const renderItem = (t) => {
    const Icon = CATEGORY_ICONS[t.cat.id] || CATEGORY_ICONS.other
    return (
      <div
        key={t.chat.id}
        className={`cp-item ${t.chat.id === activeChatId ? 'active' : ''}`}
        onClick={() => onSelectChat(t.chat.id)}
        title={t.chat.title || 'New chat'}
      >
        <span className="cp-ic"><Icon /></span>
        <div className="cp-main">
          <div className="cp-row1">
            <span className="cp-title">{t.chat.title || 'New chat'}</span>
            <span className="cp-time">{relativeTime(t.ts)}</span>
          </div>
          <div className="cp-preview">{t.preview || 'No messages yet'}</div>
        </div>
        <button
          type="button"
          className="cp-del"
          aria-label="Delete conversation"
          onClick={(e) => {
            e.stopPropagation()
            onDeleteChat(t.chat.id)
          }}
        >
          ×
        </button>
      </div>
    )
  }

  return (
    <>
      <div className={`scrim ${open ? 'show' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${open ? 'open' : 'collapsed'}`}>
        {/* Category icon rail — always visible. */}
        <div className="cat-rail">
          <button
            type="button"
            className="cat-brand"
            onClick={onToggle}
            title="AWCP"
            aria-label="Toggle sidebar"
          >
            Ai
          </button>

          <div className="cat-scroll">
            {[{ id: 'all' }, ...railCats].map((cat) => {
              const Icon = CATEGORY_ICONS[cat.id] || CATEGORY_ICONS.other
              return (
                <button
                  type="button"
                  key={cat.id}
                  className={`cat-btn ${activeCat === cat.id ? 'active' : ''}`}
                  onClick={() => pickCat(cat.id)}
                  title={cat.id === 'all' ? 'All chats' : cat.label}
                  aria-label={cat.id === 'all' ? 'All chats' : cat.label}
                >
                  <Icon />
                </button>
              )
            })}
          </div>

          <button
            type="button"
            className="cat-btn cat-new"
            onClick={onNewChat}
            title="New chat"
            aria-label="New chat"
          >
            <ComposeIcon />
          </button>
          <button
            type="button"
            className="cat-btn cat-settings"
            onClick={onOpenSettings}
            title="Settings"
            aria-label="Settings"
          >
            <GearIcon />
          </button>
        </div>

        {/* Chat panel. */}
        <div className="chat-panel">
          <div className="cp-head">
            <span className="cp-heading">Chats ({chats.length})</span>
            <button type="button" className="cp-new-btn" onClick={onNewChat} title="New chat" aria-label="New chat">
              <PlusIcon />
            </button>
            <button
              type="button"
              className="cp-collapse"
              onClick={onToggle}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <PanelIcon />
            </button>
          </div>

          <div className="cp-search">
            <SearchIcon className="cp-search-ic" />
            <input
              ref={searchRef}
              className="cp-search-input"
              type="text"
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button type="button" className="cp-search-clear" onClick={() => setQuery('')} aria-label="Clear search">
                ×
              </button>
            )}
          </div>

          <div className="cp-list">
            {/* The chat being composed (no id yet) shows as an active row up top. */}
            {!activeChatId && !q && activeCat === 'all' && (
              <div className="cp-item active">
                <span className="cp-ic"><ComposeIcon /></span>
                <div className="cp-main">
                  <div className="cp-row1">
                    <span className="cp-title">New chat</span>
                    <span className="cp-time">now</span>
                  </div>
                  <div className="cp-preview">Ask anything</div>
                </div>
              </div>
            )}

            {chats.length === 0 && <div className="cp-empty">No conversations yet</div>}
            {chats.length > 0 && visible.length === 0 && (
              <div className="cp-empty">{q ? `No chats match “${query.trim()}”` : 'No chats in this topic'}</div>
            )}

            {groups.map((g) => (
              <div className="cp-group" key={g.cat ? g.cat.id : 'flat'}>
                {g.cat && <div className="cp-section">{g.cat.label}</div>}
                {g.items.map(renderItem)}
              </div>
            ))}
          </div>

          {/* Settings bar pinned to the bottom of the panel. */}
          <button type="button" className="settings-bar" onClick={onOpenSettings}>
            <GearIcon className="sb-gear" />
            <span>Settings</span>
          </button>
        </div>
      </aside>
    </>
  )
}
