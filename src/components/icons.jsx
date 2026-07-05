// Small inline line-icons (stroke = currentColor) used by the sidebar rail and
// the top bar. Kept here so the panel-toggle glyph stays identical wherever the
// sidebar is opened/closed from.
const stroke = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

// Compose / new chat (pencil in a square).
export const ComposeIcon = (p) => (
  <svg {...stroke} {...p}>
    <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" />
  </svg>
)

export const SearchIcon = (p) => (
  <svg {...stroke} {...p}>
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

export const ChatIcon = (p) => (
  <svg {...stroke} {...p}>
    <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" />
  </svg>
)

// Sidebar / panel toggle (rectangle with a divider near the left edge).
export const PanelIcon = (p) => (
  <svg {...stroke} {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <line x1="9" y1="4" x2="9" y2="20" />
  </svg>
)

// Plain "+" glyph as an SVG so it lines up with the other stroke icons.
export const PlusIcon = (p) => (
  <svg {...stroke} {...p}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

// Settings gear.
export const GearIcon = (p) => (
  <svg {...stroke} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

// Info "(i)" used in the top bar (mirrors the reference design).
export const InfoIcon = (p) => (
  <svg {...stroke} {...p}>
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="11" x2="12" y2="16" />
    <line x1="12" y1="8" x2="12" y2="8" />
  </svg>
)

// ── Category glyphs (one per topic in categorize.js) ─────────────────────────
// "All chats" — stacked layers.
export const AllIcon = (p) => (
  <svg {...stroke} {...p}>
    <path d="M12 2 2 7l10 5 10-5-10-5z" />
    <path d="M2 17l10 5 10-5" />
    <path d="M2 12l10 5 10-5" />
  </svg>
)

export const PlaneIcon = (p) => (
  <svg {...stroke} {...p}>
    <path d="M17.8 19.2 16 11l3.5-3.5a2.12 2.12 0 0 0-3-3L13 8 4.8 6.2a.5.5 0 0 0-.5.8l3.2 4-2.3 2.3-1.6-.4a.5.5 0 0 0-.5.8L6 17l1.7 2.7a.5.5 0 0 0 .8-.1l-.4-1.6 2.3-2.3 4 3.2a.5.5 0 0 0 .8-.5z" />
  </svg>
)

export const CodeIcon = (p) => (
  <svg {...stroke} {...p}>
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
)

export const MusicIcon = (p) => (
  <svg {...stroke} {...p}>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
)

export const PenIcon = (p) => (
  <svg {...stroke} {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
  </svg>
)

export const DollarIcon = (p) => (
  <svg {...stroke} {...p}>
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
)

export const FoodIcon = (p) => (
  <svg {...stroke} {...p}>
    <path d="M4 3v7a3 3 0 0 0 6 0V3" />
    <line x1="7" y1="3" x2="7" y2="21" />
    <path d="M17 3c-1.5 1-2.5 3-2.5 6 0 2 1 3 2.5 3v9" />
  </svg>
)

export const GameIcon = (p) => (
  <svg {...stroke} {...p}>
    <line x1="6" y1="11" x2="10" y2="11" />
    <line x1="8" y1="9" x2="8" y2="13" />
    <line x1="15" y1="12" x2="15.01" y2="12" />
    <line x1="18" y1="10" x2="18.01" y2="10" />
    <rect x="2" y="6" width="20" height="12" rx="6" />
  </svg>
)

export const BookIcon = (p) => (
  <svg {...stroke} {...p}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
)

// Map every category id (from categorize.js, incl. "other"/"all") to its glyph.
export const CATEGORY_ICONS = {
  all: AllIcon,
  travel: PlaneIcon,
  coding: CodeIcon,
  music: MusicIcon,
  writing: PenIcon,
  finance: DollarIcon,
  food: FoodIcon,
  gaming: GameIcon,
  learning: BookIcon,
  other: ChatIcon,
}
