import { useState } from 'react'
import { supabase } from '../lib/supabase'

// Login screen — locked Mix4+Rust+Lime palette (literal hexes, not legacy
// CSS vars) so it stays readable on the new #080b16 page bg. Auth logic
// is unchanged from the prior version.
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
    background: '#0f1422',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 3,
    padding: '11px 13px',
    fontFamily: "'Geist Mono', monospace",
    fontSize: 13,
    color: '#ffffff',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  }

  const labelStyle = {
    display: 'block',
    fontFamily: "'Geist Mono', monospace",
    fontSize: 10,
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    color: '#b8c4d4',
    marginBottom: 6,
  }

  return (
    <>
      {/* Placeholder-color rule — applies to any future placeholder text
          on this surface; current inputs render no placeholder. */}
      <style>{`
        .login-input::placeholder { color: #8892a4; opacity: 1; }
      `}</style>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background:
            'radial-gradient(circle at 50% 30%, rgba(13,190,130,0.08), transparent 60%), #080b16',
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
            background: '#0f1422',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 3,
            padding: '36px 32px',
            boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
          }}
        >
          {/* Wordmark — title is white, '0' carries the locked emerald accent
              consistent with the rest of the app (sidebar, hero, etc.). */}
          <div
            style={{
              fontFamily: "'Geist', sans-serif",
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: '0.16em',
              color: '#ffffff',
              textAlign: 'center',
            }}
          >
            HORIZ<span style={{ color: '#0dbe82' }}>0</span>N
          </div>
          <div
            style={{
              fontFamily: "'Geist Mono', monospace",
              fontSize: 11,
              letterSpacing: '0.12em',
              color: '#8892a4',
              textAlign: 'center',
              marginTop: 10,
              marginBottom: 28,
            }}
          >
            Operational intelligence infrastructure
          </div>

          <form onSubmit={handleSubmit}>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              className="login-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#0dbe82')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
            />

            <label style={{ ...labelStyle, margin: '18px 0 6px' }}>Password</label>
            <input
              type="password"
              className="login-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#0dbe82')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
            />

            {error && (
              <div
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 12,
                  color: '#ff4d6d',
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
                fontFamily: "'Geist Mono', monospace",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: submitting ? '#8892a4' : '#062017',
                background: submitting ? 'rgba(13,190,130,0.35)' : '#0dbe82',
                border: 'none',
                borderRadius: 3,
                padding: '12px 0',
                cursor: submitting ? 'default' : 'pointer',
                transition: 'box-shadow 0.2s, background 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!submitting) e.currentTarget.style.boxShadow = '0 0 20px rgba(13,190,130,0.45)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              {submitting ? 'Authenticating…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
