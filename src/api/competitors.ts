// Sc0pe — custom competitors backend calls. REST to the radar backend,
// slug-scoped by org, VITE_RADAR_API_URL (same base as src/api/detection.ts).
//
// Unlike detection.ts, the /api/competitors endpoints are auth-hardened
// server-side (authorizeOrgAccess: valid Supabase JWT + org ownership), so
// every call must carry the session bearer — without it the backend 401s.
//
// The default 12 are locked server-side and returned for display only; the
// custom array is the full per-org replacement set (lowercased, deduped,
// max 10 — all enforced by the backend).
import { supabase } from '../lib/supabase'

const BASE = import.meta.env.VITE_RADAR_API_URL ?? 'http://localhost:3000'

async function authHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession()
    const t = data.session?.access_token
    return t ? { Authorization: `Bearer ${t}` } : {}
  } catch {
    return {}
  }
}

export interface CompetitorSet {
  defaults: string[]
  custom: string[]
}

const EMPTY: CompetitorSet = { defaults: [], custom: [] }

function coerce(data: unknown): CompetitorSet {
  if (data && typeof data === 'object') {
    const d = data as { defaults?: unknown; custom?: unknown }
    return {
      defaults: Array.isArray(d.defaults) ? (d.defaults as string[]) : [],
      custom: Array.isArray(d.custom) ? (d.custom as string[]) : [],
    }
  }
  return EMPTY
}

export async function fetchCompetitors(orgId: string): Promise<CompetitorSet> {
  try {
    const res = await fetch(
      `${BASE}/api/competitors/${encodeURIComponent(orgId)}`,
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
 * server-canonical set ({ defaults, custom }) so the caller can re-render
 * from the source of truth, or null on failure (caller keeps prior state).
 */
export async function updateCompetitors(
  orgId: string,
  competitors: string[],
): Promise<CompetitorSet | null> {
  try {
    const res = await fetch(
      `${BASE}/api/competitors/${encodeURIComponent(orgId)}`,
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
