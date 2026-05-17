import { useAuth } from '../context/AuthContext'
import { useOrg } from '../context/OrgContext'

// Lives in the fixed top header (right side). Matches the existing
// dark-nav language — no new design tokens, monospace, muted text.
export default function AccountMenu() {
  const { email, signOut } = useAuth()
  const { org } = useOrg()

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          lineHeight: 1.3,
        }}
      >
        {org?.name && (
          <span
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              color: '#94c864',
              letterSpacing: '0.06em',
            }}
          >
            {org.name}
          </span>
        )}
        <span
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10,
            color: 'var(--text-muted)',
          }}
        >
          {email}
        </span>
      </div>
      <button
        onClick={signOut}
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 5,
          padding: '5px 10px',
          cursor: 'pointer',
          transition: 'color 0.15s, border-color 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.color = 'var(--red)'
          e.currentTarget.style.borderColor = 'rgba(255,77,109,0.4)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = 'var(--text-muted)'
          e.currentTarget.style.borderColor = 'var(--border)'
        }}
      >
        Sign Out
      </button>
    </div>
  )
}
