// Sc0pe P6 — autonomous event detection backend calls. Mirrors the
// src/api/radarBrief.ts pattern (REST to the radar backend), NOT a Supabase
// call: the detection endpoints live on the backend, slug-scoped by org.
//
// NOTE: the codebase's backend base env var is VITE_RADAR_API_URL (see
// radarBrief.ts), not VITE_BACKEND_URL — using the real one so prod resolves.
const BASE = import.meta.env.VITE_RADAR_API_URL ?? 'http://localhost:3000'

export interface DetectedEvent {
  id: string
  org_id: string
  title: string
  source_url: string
  source_name: string
  event_type: string
  confidence: number
  reasoning: string
  urgency: string
  raw_title: string
  detected_at: string
  confirmed: boolean
  dismissed: boolean
}

export interface DetectionSettings {
  org_id: string
  min_confidence: number
  event_types: string[]
  geos: string[]
  urgency_filter: string[]
  competitor_mention_only: boolean
  gender: string
  age_range: string
  sophistication: string
  type_confidence_adjustments?: Record<string, number>
  auto_brief?: boolean
}

export async function fetchDetectedEvents(orgId: string): Promise<DetectedEvent[]> {
  const res = await fetch(
    `${BASE}/api/detected-events?org_id=${encodeURIComponent(orgId)}`,
  )
  if (!res.ok) return []
  const data: unknown = await res.json().catch(() => null)
  if (data && typeof data === 'object' && Array.isArray((data as { events?: unknown }).events)) {
    return (data as { events: DetectedEvent[] }).events
  }
  return []
}

export async function confirmDetectedEvent(id: string): Promise<void> {
  await fetch(`${BASE}/api/detected-events/${encodeURIComponent(id)}/confirm`, {
    method: 'POST',
  })
}

export async function dismissDetectedEvent(id: string): Promise<void> {
  await fetch(`${BASE}/api/detected-events/${encodeURIComponent(id)}/dismiss`, {
    method: 'POST',
  })
}

export async function fetchDetectionSettings(
  orgId: string,
): Promise<DetectionSettings | null> {
  const res = await fetch(
    `${BASE}/api/detection-settings/${encodeURIComponent(orgId)}`,
  )
  if (!res.ok) return null
  const data: unknown = await res.json().catch(() => null)
  return (data && typeof data === 'object') ? (data as DetectionSettings) : null
}

export async function updateDetectionSettings(
  orgId: string,
  patch: Partial<DetectionSettings>,
): Promise<DetectionSettings | null> {
  const res = await fetch(
    `${BASE}/api/detection-settings/${encodeURIComponent(orgId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    },
  )
  if (!res.ok) return null
  const data: unknown = await res.json().catch(() => null)
  return (data && typeof data === 'object') ? (data as DetectionSettings) : null
}

// P7 — dedicated auto-brief toggle endpoint (the generic settings PATCH does
// not accept auto_brief). Mirrors updateDetectionSettings: null on failure.
export async function updateAutoBrief(
  orgId: string,
  autoBrief: boolean,
): Promise<DetectionSettings | null> {
  const res = await fetch(
    `${BASE}/api/detection-settings/${encodeURIComponent(orgId)}/auto-brief`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auto_brief: autoBrief }),
    },
  )
  if (!res.ok) return null
  const data: unknown = await res.json().catch(() => null)
  return (data && typeof data === 'object') ? (data as DetectionSettings) : null
}

export async function runDetectNow(orgId: string): Promise<number> {
  const res = await fetch(`${BASE}/api/detect-events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ org_id: orgId }),
  })
  if (!res.ok) return 0
  const data: unknown = await res.json().catch(() => null)
  if (data && typeof data === 'object' && typeof (data as { inserted?: unknown }).inserted === 'number') {
    return (data as { inserted: number }).inserted
  }
  return 0
}

// ── Adapter ────────────────────────────────────────────────────────────────
// Map a DetectedEvent into the RadarEvent shape so the existing timeline /
// EventCard / BriefPanel pipeline renders it unchanged. Synthetic id is a
// stable NEGATIVE integer (seeded ids are positive) so the two never collide.

const TYPE_TO_CAT: Record<string, 'sports' | 'web3' | 'business' | 'cultural'> = {
  sports: 'sports',
  web3: 'web3',
  cultural: 'cultural',
  business: 'business',
  regulatory: 'business',
  other: 'business',
}

export function detectedSyntheticId(uuid: string): number {
  let h = 0
  for (let i = 0; i < uuid.length; i++) h = (h * 31 + uuid.charCodeAt(i)) | 0
  // Always negative, never 0 — keeps it clear of seeded positive ids.
  return -(Math.abs(h) + 1)
}
