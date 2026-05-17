import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, setActiveOrgId } from '../lib/supabase'
import { useAuth } from './AuthContext'

const OrgContext = createContext(null)

function LoadingOrg() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 12,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
      }}
    >
      Loading workspace…
    </div>
  )
}

export function OrgProvider({ children }) {
  const { email } = useAuth()
  const [org, setOrg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!email) return

    let mounted = true
    setLoading(true)
    setError(null)

    // Auth-derived tenant: the signed-in user's row carries org_id; RLS
    // guarantees only this user's row is visible. Embed the org record.
    supabase
      .from('users')
      .select('org_id, orgs ( id, name, slug, budget_tier, capabilities, competitor_set, geo_focus )')
      .eq('email', email)
      .single()
      .then(({ data, error: qErr }) => {
        if (!mounted) return

        if (qErr || !data?.orgs) {
          // Don't block the dashboard forever — surface the issue but let
          // the app render so existing P1 UI stays usable.
          // eslint-disable-next-line no-console
          console.error('[org] failed to resolve org for', email, qErr)
          setError(qErr?.message ?? 'No organisation bound to this account.')
          setOrg(null)
          setActiveOrgId(null)
          setLoading(false)
          return
        }

        setOrg(data.orgs)
        setActiveOrgId(data.orgs.id)
        setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [email])

  if (loading) {
    return <LoadingOrg />
  }

  return (
    <OrgContext.Provider value={{ org, error }}>{children}</OrgContext.Provider>
  )
}

export function useOrg() {
  const ctx = useContext(OrgContext)
  if (!ctx) {
    throw new Error('useOrg must be used within an OrgProvider')
  }
  return ctx
}
