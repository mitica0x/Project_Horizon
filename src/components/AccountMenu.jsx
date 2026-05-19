import { useAuth } from '../context/AuthContext'

// Lives in the fixed top header (far right). Single row: email + sign out.
// Matches the existing dark-nav language — monospace, muted text.
export default function AccountMenu() {
  const { email, signOut } = useAuth()

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <span
        style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 10,
          color: 'var(--text-muted)',
        }}
      >
        {email}
      </span>
      <button
        onClick={signOut}
        style={{
          fontFamily: "'Geist Mono', monospace",
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
