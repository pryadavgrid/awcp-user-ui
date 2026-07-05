import { useState } from 'react'

// New-chat welcome card (mirrors the reference design): three tabs —
// Examples / Capabilities / Limitations. Example rows are clickable and drop the
// prompt straight into the composer via `onPick`; the other two tabs are
// informational. Purely presentational; the real send flow stays in the composer.
const TABS = [
  {
    id: 'examples',
    label: 'Examples',
    icon: '☀',
    clickable: true,
    items: [
      'Got any creative ideas for a 10 year old’s birthday?',
      'Explain quantum computing in simple terms',
      'How do I make an HTTP request in Javascript?',
    ],
  },
  {
    id: 'capabilities',
    label: 'Capabilities',
    icon: '⚡',
    clickable: false,
    items: [
      'Remembers what you said earlier in the conversation',
      'Allows follow-up corrections',
      'Picks the agent you choose in the composer',
    ],
  },
  {
    id: 'limitations',
    label: 'Limitations',
    icon: '⚠',
    clickable: false,
    items: [
      'May occasionally generate incorrect information',
      'May occasionally produce biased content',
      'Limited knowledge of the world after its training cutoff',
    ],
  },
]

export default function WelcomeCard({ onPick, disabled }) {
  const [active, setActive] = useState('examples')
  const tab = TABS.find((t) => t.id === active) || TABS[0]

  return (
    <div className="welcome-card">
      <div className="wc-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`wc-tab ${t.id === active ? 'active' : ''}`}
            onClick={() => setActive(t.id)}
          >
            <span className="wc-tab-ic" aria-hidden="true">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="wc-list">
        {tab.items.map((text) =>
          tab.clickable ? (
            <button
              key={text}
              type="button"
              className="wc-item pick"
              disabled={disabled}
              onClick={() => onPick(text)}
              title="Use this prompt"
            >
              <span className="wc-item-text">{text}</span>
              <span className="wc-item-arrow" aria-hidden="true">→</span>
            </button>
          ) : (
            <div key={text} className="wc-item">
              <span className="wc-item-text">{text}</span>
            </div>
          ),
        )}
      </div>
    </div>
  )
}
