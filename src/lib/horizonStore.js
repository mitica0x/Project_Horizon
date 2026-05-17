// Horiz0n Supabase data layer (P4 activations, P5 decisions, P6 war room).
// Follows the codebase convention: never throw into the UI — log loud to
// console, return a soft result so P1 and the rest of the suite keep working
// even if a table/column is missing or RLS rejects the row.

import { supabase, getActiveOrgId, getActiveOrgSlug } from './supabase'

const DAY = 86400000

// ── Bybit EU demo seed (S3) ────────────────────────────────────────────────
// When the live store has no rows for the bybit-eu org, these seeded rows make
// OUTCOMES / LEDGER / BRIEF / WINDOWS read as live for the demo. Guarded:
// only injected when (no real rows) AND (active org slug === 'bybit-eu'),
// matching the spec's `if (org === 'bybit-eu' && no real data exists)`.
const DEMO_ORG_SLUG = 'bybit-eu'

function isDemoOrg() {
  return getActiveOrgSlug() === DEMO_ORG_SLUG
}

const SEED_ACTIVATIONS = [
  {
    id: 'seed-act-finder',
    event_name: 'finder.com/uk/crypto — UK T1 editorial placement',
    activated_at: '2026-05-01T09:00:00.000Z',
    created_at: '2026-05-01T09:00:00.000Z',
    outcome: 'win',
    outcome_status: 'closed',
    note: 'Bybit added to main exchange comparison table. Revolut and Kraken also listed. Editorial placement.',
    outcome_note:
      'Listed. Estimated monthly reach: 180k UK visitors. Reviewed 14 May 2026.',
  },
  {
    id: 'seed-act-investopedia',
    event_name: 'investopedia.com/best-crypto-exchanges — Global T1 outreach',
    activated_at: '2026-05-08T09:00:00.000Z',
    created_at: '2026-05-08T09:00:00.000Z',
    outcome_status: 'pending',
    note: 'IN PROGRESS — Outreach sent to partnerships team. Awaiting response. Coinbase currently primary. High-value target.',
  },
  {
    id: 'seed-act-nerdwallet',
    event_name: 'nerdwallet.com/best-crypto-exchange — Global T1 (OPP 87)',
    activated_at: '2026-05-12T09:00:00.000Z',
    created_at: '2026-05-12T09:00:00.000Z',
    outcome_status: 'pending',
    note: 'PENDING — Contact identified. Not yet reached out. Kraken and Revolut listed. OPP 87.',
  },
]

// Newest-first (matches the live query's .order('decided_at', desc)).
const SEED_DECISIONS = [
  {
    id: 'seed-dec-budget',
    decision: 'activate',
    event_name: 'Allocated €8k to affiliate outreach Q2',
    rationale:
      'Board approved Q2 affiliate budget. Allocated to UK T1 gap closure programme. Target: 3 T1 placements by end of May. Outcome: 1 of 3 confirmed (finder.com). 2 in pipeline.',
    decided_at: '2026-05-10T10:00:00.000Z',
    context_snapshot: { type: 'BUDGET', cap: '€8k/quarter', target: '3 T1 placements' },
    competitor_moves: null,
    revisit_at: null,
    revisit_note: null,
  },
  {
    id: 'seed-dec-priority',
    decision: 'activate',
    event_name: 'Prioritised UK T1 over DE expansion',
    rationale:
      'Budget ceiling: €8k/month affiliate outreach. Decision: concentrate on UK T1 gaps where Revolut is primary threat before expanding to DE. Outcome: Pending — DE gaps still uncontacted.',
    decided_at: '2026-05-05T10:00:00.000Z',
    context_snapshot: { type: 'PRIORITISATION', focus: 'UK T1', deferred: 'DE expansion' },
    competitor_moves: null,
    revisit_at: null,
    revisit_note: null,
  },
  {
    id: 'seed-dec-posture',
    decision: 'defer',
    event_name: 'Shifted posture to PREPARE',
    rationale:
      'Revolut accelerating in UK T1. Field pressure rising. Decision: stage assets, hold spend until finder.com placement confirmed. Outcome: finder.com win confirmed May 14. Correct call.',
    decided_at: '2026-05-01T10:00:00.000Z',
    context_snapshot: { type: 'POSTURE', posture: 'PREPARE', trigger: 'Revolut UK T1 acceleration' },
    competitor_moves: { pressure: 58 },
    revisit_at: null,
    revisit_note: null,
  },
]

function soft(scope, error) {
  // eslint-disable-next-line no-console
  console.error(`[horizon:${scope}]`, error?.message ?? error)
  return { data: null, error }
}

function requireOrg(scope) {
  const orgId = getActiveOrgId()
  if (!orgId) {
    // eslint-disable-next-line no-console
    console.warn(`[horizon:${scope}] no active org — skipped (P1 unaffected)`)
  }
  return orgId
}

// ── Decisions (P5) ─────────────────────────────────────────────────────────
// decision ∈ 'activate' | 'skip' | 'defer'
export async function logDecision({
  eventName,
  decision,
  rationale = null,
  contextSnapshot = null,
  competitorMoves = null,
  revisitAt = null,
}) {
  const orgId = requireOrg('logDecision')
  if (!orgId) return { data: null, error: 'no-org' }
  try {
    const { data, error } = await supabase
      .from('decisions')
      .insert({
        org_id: orgId,
        event_name: eventName,
        decision,
        rationale,
        context_snapshot: contextSnapshot,
        competitor_moves: competitorMoves,
        revisit_at: revisitAt,
      })
      .select()
      .single()
    if (error) return soft('logDecision', error)
    return { data, error: null }
  } catch (e) {
    return soft('logDecision', e)
  }
}

export async function fetchDecisions() {
  const orgId = requireOrg('fetchDecisions')
  if (!orgId) {
    // No org bound — still seed the demo if the slug resolved as bybit-eu.
    return isDemoOrg()
      ? { data: SEED_DECISIONS, error: null }
      : { data: [], error: 'no-org' }
  }
  try {
    const { data, error } = await supabase
      .from('decisions')
      .select('*')
      .eq('org_id', orgId)
      .order('decided_at', { ascending: false })
    const rows = error ? [] : data ?? []
    if (rows.length === 0 && isDemoOrg()) {
      return { data: SEED_DECISIONS, error: null }
    }
    if (error) return { data: [], error }
    return { data: rows, error: null }
  } catch (e) {
    soft('fetchDecisions', e)
    return isDemoOrg()
      ? { data: SEED_DECISIONS, error: null }
      : { data: [], error: e }
  }
}

// ── Activations (P4) ───────────────────────────────────────────────────────
// The activations table pre-exists server-side; this is the missing
// frontend write-path. Activate = create activation + 'activate' decision.
// Dismiss = 'skip' decision only (no campaign), revisit in 14 days.
export async function activateEvent({ eventName, note = null, snapshot = null }) {
  const orgId = requireOrg('activateEvent')
  if (!orgId) return { data: null, error: 'no-org' }
  let activation = null
  try {
    const { data, error } = await supabase
      .from('activations')
      .insert({
        org_id: orgId,
        event_name: eventName,
        note,
        activated_at: new Date().toISOString(),
        outcome_status: 'pending',
      })
      .select()
      .single()
    if (error) {
      soft('activateEvent', error)
    } else {
      activation = data
    }
  } catch (e) {
    soft('activateEvent', e)
  }
  await logDecision({
    eventName,
    decision: 'activate',
    rationale: note,
    contextSnapshot: snapshot,
    competitorMoves: snapshot?.field ?? null,
  })
  return { data: activation, error: activation ? null : 'activation-failed' }
}

export async function dismissEvent({ eventName, rationale = null, snapshot = null }) {
  return logDecision({
    eventName,
    decision: 'skip',
    rationale,
    contextSnapshot: snapshot,
    competitorMoves: snapshot?.field ?? null,
    revisitAt: new Date(Date.now() + 14 * DAY).toISOString(),
  })
}

export async function fetchActivations() {
  const orgId = requireOrg('fetchActivations')
  if (!orgId) {
    return isDemoOrg()
      ? { data: SEED_ACTIVATIONS, error: null }
      : { data: [], error: 'no-org' }
  }
  try {
    const { data, error } = await supabase
      .from('activations')
      .select('*')
      .eq('org_id', orgId)
      .order('activated_at', { ascending: false })
    const rows = error ? [] : data ?? []
    if (rows.length === 0 && isDemoOrg()) {
      return { data: SEED_ACTIVATIONS, error: null }
    }
    if (error) return { data: [], error }
    return { data: rows, error: null }
  } catch (e) {
    soft('fetchActivations', e)
    return isDemoOrg()
      ? { data: SEED_ACTIVATIONS, error: null }
      : { data: [], error: e }
  }
}

export async function updateActivationOutcome(id, patch) {
  try {
    const { data, error } = await supabase
      .from('activations')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) return soft('updateActivationOutcome', error)
    return { data, error: null }
  } catch (e) {
    return soft('updateActivationOutcome', e)
  }
}

// ── N0va sessions (P6) ─────────────────────────────────────────────────────
// DB table name (war_room_sessions) is a created schema object — left intact
// so existing migration 004 / persisted rows keep working.
export async function startNova(triggerType = 'manual') {
  const orgId = requireOrg('startNova')
  if (!orgId) return { data: null, error: 'no-org' }
  try {
    const { data, error } = await supabase
      .from('war_room_sessions')
      .insert({
        org_id: orgId,
        trigger_type: triggerType,
        started_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (error) return soft('startNova', error)
    return { data, error: null }
  } catch (e) {
    return soft('startNova', e)
  }
}

export async function endNova(id, notes = null) {
  if (!id) return { data: null, error: 'no-session' }
  try {
    const { data, error } = await supabase
      .from('war_room_sessions')
      .update({ ended_at: new Date().toISOString(), notes })
      .eq('id', id)
      .select()
      .single()
    if (error) return soft('endNova', error)
    return { data, error: null }
  } catch (e) {
    return soft('endNova', e)
  }
}
