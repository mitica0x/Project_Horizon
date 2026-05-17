import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Never white-screen silently — surface a loud, actionable error if the
// environment is not wired up. AuthContext reads `supabaseConfigured` and
// renders a config-error screen instead of crashing on createClient().
export const supabaseConfigured = Boolean(url && publishableKey)

if (!supabaseConfigured) {
  // eslint-disable-next-line no-console
  console.error(
    '[supabase] Missing environment variables. ' +
      'Expected VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env — ' +
      'auth and org isolation are disabled until these are set.'
  )
}

// When unconfigured we still export a usable object so imports don't throw;
// AuthContext gates the whole app on `supabaseConfigured` before any call.
export const supabase = supabaseConfigured
  ? createClient(url, publishableKey)
  : createClient('https://placeholder.supabase.co', 'placeholder-key')

// Active org id — set after the org resolves post-login, read by data-layer
// callers that need the current tenant without threading React context.
let activeOrgId = null

export function setActiveOrgId(id) {
  activeOrgId = id ?? null
}

export function getActiveOrgId() {
  return activeOrgId
}
