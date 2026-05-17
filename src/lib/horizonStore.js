// Horiz0n Supabase data layer (P4 activations, P5 decisions, P6 war room).
// Follows the codebase convention: never throw into the UI — log loud to
// console, return a soft result so P1 and the rest of the suite keep working
// even if a table/column is missing or RLS rejects the row.

import { supabase, getActiveOrgId } from './supabase'

const DAY = 86400000

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
  if (!orgId) return { data: [], error: 'no-org' }
  try {
    const { data, error } = await supabase
      .from('decisions')
      .select('*')
      .eq('org_id', orgId)
      .order('decided_at', { ascending: false })
    if (error) return { data: [], error }
    return { data: data ?? [], error: null }
  } catch (e) {
    soft('fetchDecisions', e)
    return { data: [], error: e }
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
  if (!orgId) return { data: [], error: 'no-org' }
  try {
    const { data, error } = await supabase
      .from('activations')
      .select('*')
      .eq('org_id', orgId)
      .order('activated_at', { ascending: false })
    if (error) return { data: [], error }
    return { data: data ?? [], error: null }
  } catch (e) {
    soft('fetchActivations', e)
    return { data: [], error: e }
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

// ── War Room sessions (P6) ─────────────────────────────────────────────────
export async function startWarRoom(triggerType = 'manual') {
  const orgId = requireOrg('startWarRoom')
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
    if (error) return soft('startWarRoom', error)
    return { data, error: null }
  } catch (e) {
    return soft('startWarRoom', e)
  }
}

export async function endWarRoom(id, notes = null) {
  if (!id) return { data: null, error: 'no-session' }
  try {
    const { data, error } = await supabase
      .from('war_room_sessions')
      .update({ ended_at: new Date().toISOString(), notes })
      .eq('id', id)
      .select()
      .single()
    if (error) return soft('endWarRoom', error)
    return { data, error: null }
  } catch (e) {
    return soft('endWarRoom', e)
  }
}
