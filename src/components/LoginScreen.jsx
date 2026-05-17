import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)

    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (authErr) {
      // Deliberately generic — no user enumeration, no reset flow.
      setError('Access denied. Contact your administrator.')
      setSubmitting(false)
      return
    }
    // Success: AuthContext's onAuthStateChange swaps in the full app.
    // Keep the button disabled through the unmount.
  }

  const inputStyle = {
    width: '100%',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '11px 13px',
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 13,
    color: 'var(--white)',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background:
          'radial-gradient(circle at 50% 30%, rgba(0,212,232,0.06), transparent 60%), var(--bg-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 360,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '36px 32px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
        }}
      >
        {/* Wordmark — same Syne treatment as the app header */}
        <div
          style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: '0.16em',
            color: '#94c864',
            textAlign: 'center',
          }}
        >
          HORIZ<span style={{ color: 'var(--cyan)' }}>0</span>N
        </div>
        <div
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            letterSpacing: '0.12em',
            color: 'var(--text-muted)',
            textAlign: 'center',
            marginTop: 10,
            marginBottom: 28,
          }}
        >
          Operational intelligence infrastructure
        </div>

        <form onSubmit={handleSubmit}>
          <label
            style={{
              display: 'block',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              marginBottom: 6,
            }}
          >
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="username"
            required
            style={inputStyle}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--cyan)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          />

          <label
            style={{
              display: 'block',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              margin: '18px 0 6px',
            }}
          >
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            style={inputStyle}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--cyan)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          />

          {error && (
            <div
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 12,
                color: 'var(--red)',
                marginTop: 18,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              marginTop: 26,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 13,
              letterSpacing: '0.12em',
              color: submitting ? 'var(--text-muted)' : 'var(--cyan)',
              background: 'var(--bg-primary)',
              border: '1px solid rgba(0,212,232,0.3)',
              borderRadius: 6,
              padding: '12px 0',
              cursor: submitting ? 'default' : 'pointer',
              transition: 'box-shadow 0.2s, color 0.2s',
            }}
            onMouseEnter={e => {
              if (!submitting)
                e.currentTarget.style.boxShadow = '0 0 16px rgba(0,212,232,0.25)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            {submitting ? 'AUTHENTICATING…' : 'SIGN IN'}
          </button>
        </form>
      </div>
    </div>
  )
}
