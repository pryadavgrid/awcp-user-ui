// Client-side topic categorization for chats. There is no categorization endpoint
// on the gateway, so we infer a chat's topic from its text with a small keyword
// map — enough to auto-create sidebar sections like "Traveling", "Coding", etc.
// A chat's category is DERIVED (never stored), so it re-settles as the
// conversation grows. Add/adjust a topic by editing CATEGORIES below.

// Each category: a stable id (also the icon key in icons.jsx), a display label
// for the section header + rail tooltip, and the keywords that place a chat here.
export const CATEGORIES = [
  {
    id: 'travel',
    label: 'Traveling',
    keywords: [
      'travel', 'traveling', 'travelling', 'flight', 'flights', 'hotel', 'hotels',
      'trip', 'vacation', 'holiday', 'itinerary', 'destination', 'tour', 'tourism',
      'airport', 'airline', 'visa', 'passport', 'beach', 'journey', 'cruise',
      'backpacking', 'sightseeing', 'booking',
    ],
  },
  {
    id: 'coding',
    label: 'Coding',
    keywords: [
      'code', 'coding', 'python', 'javascript', 'js', 'java', 'html', 'css',
      'react', 'api', 'function', 'bug', 'debug', 'program', 'programming',
      'script', 'algorithm', 'sql', 'node', 'typescript', 'compile', 'variable',
      'array', 'loop', 'regex', 'git', 'terminal',
    ],
  },
  {
    id: 'music',
    label: 'Music',
    keywords: [
      'music', 'song', 'songs', 'playlist', 'album', 'artist', 'lyrics', 'guitar',
      'piano', 'band', 'spotify', 'melody', 'chords', 'genre',
    ],
  },
  {
    id: 'writing',
    label: 'Writing',
    keywords: [
      'essay', 'write', 'writing', 'letter', 'cover letter', 'poem', 'story',
      'blog', 'article', 'resume', 'email', 'paragraph', 'draft', 'grammar',
      'rewrite', 'summary', 'summarize',
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    keywords: [
      'money', 'finance', 'financial', 'invest', 'investing', 'stock', 'stocks',
      'inflation', 'budget', 'tax', 'taxes', 'loan', 'salary', 'economy',
      'economic', 'crypto', 'bitcoin', 'bank', 'interest', 'mortgage', 'savings',
    ],
  },
  {
    id: 'food',
    label: 'Food',
    keywords: [
      'recipe', 'food', 'cook', 'cooking', 'meal', 'dish', 'restaurant',
      'ingredient', 'ingredients', 'bake', 'baking', 'diet', 'nutrition',
      'breakfast', 'lunch', 'dinner',
    ],
  },
  {
    id: 'gaming',
    label: 'Gaming',
    keywords: [
      'game', 'games', 'gaming', 'gta', 'minecraft', 'xbox', 'playstation',
      'nintendo', 'cheat', 'cheats', 'fortnite', 'gameplay', 'gamer', 'console',
    ],
  },
  {
    id: 'learning',
    label: 'Learning',
    keywords: [
      'explain', 'learn', 'study', 'define', 'definition', 'concept', 'tutorial',
      'teach', 'what is', 'what are', 'how does', 'how do', 'difference between',
      'meaning of', 'overview',
    ],
  },
]

// The fallback bucket for chats that match no topic above.
export const OTHER = { id: 'other', label: 'General' }

// The "show everything" pseudo-category used by the rail's top icon.
export const ALL = { id: 'all', label: 'All chats' }

// Human label for any category id (incl. 'all' and 'other') — used by the rail
// tooltip and the workspace header.
export function categoryLabel(id) {
  if (id === ALL.id) return ALL.label
  if (id === OTHER.id) return OTHER.label
  const c = CATEGORIES.find((x) => x.id === id)
  return c ? c.label : OTHER.label
}

// Precompiled word-boundary matchers so short keywords ("js", "api") don't match
// inside unrelated words ("adjust", "apiece"). Multi-word keys match as a phrase.
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const MATCHERS = CATEGORIES.map((c) => ({
  cat: c,
  res: c.keywords.map((k) => new RegExp(`\\b${escapeRe(k)}\\b`, 'i')),
}))

// The searchable text of a chat: its title plus every message's text.
function chatText(chat) {
  const msgs = (chat.messages || []).map((m) => m.text || '').join(' ')
  return `${chat.title || ''} ${msgs}`
}

// Pick the best-matching category (most keyword hits wins; ties keep the earlier
// category, which is the higher-priority one in CATEGORIES). Returns OTHER when
// nothing matches.
export function categorize(chat) {
  const text = chatText(chat)
  let best = OTHER
  let bestScore = 0
  for (const { cat, res } of MATCHERS) {
    let score = 0
    for (const re of res) if (re.test(text)) score += 1
    if (score > bestScore) {
      bestScore = score
      best = cat
    }
  }
  return best
}

// Compact relative timestamp ("now", "5m", "2h", "3d", "1w", "2mo") like the
// chat list in the reference design.
export function relativeTime(ts) {
  if (!ts) return ''
  const secs = Math.max(0, (Date.now() - ts) / 1000)
  if (secs < 45) return 'now'
  const mins = secs / 60
  if (mins < 60) return `${Math.round(mins)}m`
  const hrs = mins / 60
  if (hrs < 24) return `${Math.round(hrs)}h`
  const days = hrs / 24
  if (days < 7) return `${Math.round(days)}d`
  const weeks = days / 7
  if (weeks < 5) return `${Math.round(weeks)}w`
  return `${Math.round(days / 30)}mo`
}
