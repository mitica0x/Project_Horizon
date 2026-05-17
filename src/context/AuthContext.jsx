import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, supabaseConfigured, setActiveOrgId, setActiveOrgSlug } from '../lib/supabase'
import LoginScreen from '../components/LoginScreen'

const AuthContext = createContext(null)

// Minimal, on-brand full-screen state used while the session resolves and
// for the hard config-error case. Matches the Horiz0n dark theme.
function FullScreenMessage({ children, accent = 'var(--text-muted)' }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Geist Mono', monospace",
        fontSize: 12,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: accent,
        textAlign: 'center',
        padding: 24,
      }}
    >
      {children}
    </div>
  )
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false)
      return
    }

    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session ?? null)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    setActiveOrgId(null)
    setActiveOrgSlug(null)
    setSession(null)
  }

  // Hard stop: env not wired. Loud, actionable, never a white screen.
  if (!supabaseConfigured) {
    return (
      <FullScreenMessage accent="var(--red)">
        Supabase environment variables missing.
        <br />
        Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env
      </FullScreenMessage>
    )
  }

  if (loading) {
    return <FullScreenMessage>Authenticating…</FullScreenMessage>
  }

  if (!session) {
    return <LoginScreen />
  }

  const value = {
    session,
    email: session.user?.email ?? null,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
