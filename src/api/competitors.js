// Horiz0n — custom competitors backend calls. Mirrors App.jsx's backend
// conventions: VITE_BACKEND_URL base + optional Supabase bearer (the
// /api/competitors endpoints are org-keyed and don't require auth, but the
// header is harmless and keeps this consistent with the rest of the app).
//
// The default 12 are locked server-side and returned for display only; the
// custom array is the full per-org replacement set (lowercased, deduped,
// max 10 — all enforced by the backend).
import { supabase } from '../lib/supabase'

const BACKEND =
  import.meta.env.VITE_BACKEND_URL || 'https://web-production-e204.up.railway.app'

const EMPTY = { defaults: [], custom: [] }

async function authHeaders() {
  try {
    const { data } = await supabase.auth.getSession()
    const t = data?.session?.access_token
    return t ? { Authorization: `Bearer ${t}` } : {}
  } catch {
    return {}
  }
}

function coerce(data) {
  if (data && typeof data === 'object') {
    return {
      defaults: Array.isArray(data.defaults) ? data.defaults : [],
      custom: Array.isArray(data.custom) ? data.custom : [],
    }
  }
  return EMPTY
}

export async function fetchCompetitors(orgId) {
  try {
    const res = await fetch(
      `${BACKEND}/api/competitors/${encodeURIComponent(orgId)}`,
      { headers: { ...(await authHeaders()) } },
    )
    if (!res.ok) return EMPTY
    return coerce(await res.json().catch(() => null))
  } catch {
    return EMPTY
  }
}

/**
 * Full-replacement PATCH of the org's custom competitor list. Returns the
 * server-canonical set ({ defaults, custom }) so the caller re-renders from
 * the source of truth, or null on failure (caller keeps prior state).
 */
export async function updateCompetitors(orgId, competitors) {
  try {
    const res = await fetch(
      `${BACKEND}/api/competitors/${encodeURIComponent(orgId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(await authHeaders()),
        },
        body: JSON.stringify({ competitors }),
      },
    )
    if (!res.ok) return null
    return coerce(await res.json().catch(() => null))
  } catch {
    return null
  }
}
