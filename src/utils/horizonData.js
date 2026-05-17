// Horiz0n P2–P9 shared selectors.
// Pure, deterministic derivations over the SAME data P1 already uses
// (RADAR_EVENTS, COMPETITORS, GAPS, threatScore). No UI, no side effects —
// every panel reads from here so numbers stay consistent across the suite.

import { RADAR_EVENTS } from '../../lib/radar/events'
import { daysUntil, getAlertInfo } from '../../lib/radar/scoring'
import { COMPETITORS, TABLE_DATA, GAPS_T1, GAPS_T2 } from '../data/staticData'
import { computeThreatScore } from './threatScore'

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))

// ── Competitor field ───────────────────────────────────────────────────────
// Aggregates the existing per-competitor threatScore into one read of how
// contested the field is right now. This is the `assessCompetitors()` the
// P2/P3/P6/P8 specs reference (it did not exist before — built on the real
// computeThreatScore + COMPETITORS so it stays in sync with the radar).
export function assessCompetitors() {
  const threats = COMPETITORS
    .map(c => computeThreatScore(c.name, TABLE_DATA, GAPS_T1, GAPS_T2))
    .sort((a, b) => b.score - a.score)

  const maxScore = Math.max(...threats.map(t => t.score), 1)
  const active = threats.filter(t => t.score > 0)
  const top3 = threats.slice(0, 3)
  const pressure = clamp(
    Math.round((top3.reduce((s, t) => s + t.score, 0) / (3 * maxScore)) * 100),
    0,
    100,
  )
  const level = pressure >= 60 ? 'high' : pressure >= 30 ? 'moderate' : 'low'

  return {
    pressure,                       // 0–100
    level,                          // 'low' | 'moderate' | 'high'
    activeCount: active.length,     // competitors present on tracked pages
    top: threats[0]?.name ?? '—',
    topScore: threats[0]?.score ?? 0,
    threats,                        // full sorted list
  }
}

// ── Per-window derivations ─────────────────────────────────────────────────
// Events carry no competitor linkage, so window pressure is derived
// deterministically from the live field strength scaled by the event's
// Bybit-relevance score. Synthetic but stable and explainable.
function windowPressure(event, field) {
  const count = clamp(
    Math.round(field.activeCount * (event.score / 10)),
    0,
    field.activeCount,
  )
  const pct = field.activeCount > 0
    ? Math.round((count / field.activeCount) * 100)
    : 0
  return { count, pct }
}

function opportunityScore(event, wp) {
  let s = event.score * 8 // 8–80
  s += event.pri === 'high' ? 12 : event.pri === 'medium' ? 6 : 0
  const status = getAlertInfo(event.date).status
  s += status === 'brief-window' ? 8
    : status === 'act-now' ? 6
    : status === 'urgent' ? 4
    : status === 'last-chance' ? 2
    : 0
  s -= Math.round(wp.pct * 0.1) // crowding penalty 0–10
  return clamp(Math.round(s), 0, 100)
}

function recommendedAction(opportunity, daysOut) {
  if (opportunity >= 70 && daysOut <= 21) return 'MOVE NOW'
  if (opportunity >= 45 || (daysOut >= 22 && daysOut <= 60)) return 'PREPARE'
  return 'MONITOR'
}

function opennessFromPressure(pct) {
  const open = 100 - pct
  const label = open >= 66 ? 'OPEN FIELD' : open >= 33 ? 'CONTESTED' : 'CROWDED'
  return { open, label }
}

const ACTION_ORDER = { 'MOVE NOW': 0, PREPARE: 1, MONITOR: 2 }

// Upcoming windows over the next 90 days, ranked.
export function getWindows(horizonDays = 90) {
  const field = assessCompetitors()
  const rows = RADAR_EVENTS
    .map(event => {
      const daysOut = daysUntil(event.date)
      const wp = windowPressure(event, field)
      const opportunity = opportunityScore(event, wp)
      const action = recommendedAction(opportunity, daysOut)
      const openness = opennessFromPressure(wp.pct)
      return {
        event,
        daysOut,
        opportunity,
        pressureCount: wp.count,
        pressurePct: wp.pct,
        action,
        openness: openness.open,
        opennessLabel: openness.label,
      }
    })
    .filter(w => w.daysOut >= 0 && w.daysOut <= horizonDays)
    .sort((a, b) =>
      ACTION_ORDER[a.action] - ACTION_ORDER[b.action] ||
      a.daysOut - b.daysOut,
    )

  const moveNowCount = rows.filter(w => w.action === 'MOVE NOW').length
  return { rows, moveNowCount, field }
}

// ── Morning status (P2) ────────────────────────────────────────────────────
export function getDayStatus() {
  const field = assessCompetitors()
  const { rows } = getWindows(90)
  const moveIn14 = rows.filter(
    w => w.action === 'MOVE NOW' && w.daysOut <= 14,
  ).length

  const competitorRag =
    field.level === 'high' ? 'red' : field.level === 'moderate' ? 'amber' : 'green'

  const signals = [
    {
      label: 'Competitor Activity',
      rag: competitorRag,
      note: `${field.top} leads · field pressure ${field.pressure}/100`,
    },
    {
      label: 'Market Sentiment',
      rag: 'amber',
      note: 'Signal monitoring active',
    },
    {
      label: 'Regulatory Noise',
      rag: 'green',
      note: 'Signal monitoring active',
    },
    {
      label: 'Upcoming Windows',
      rag: moveIn14 >= 1 ? 'green' : 'amber',
      note: `${moveIn14} MOVE-rated in next 14 days`,
    },
    {
      label: 'Team Execution',
      rag: 'green',
      note: 'Signal monitoring active',
    },
  ]

  const overall = signals.some(s => s.rag === 'red')
    ? 'RED'
    : signals.some(s => s.rag === 'amber')
    ? 'AMBER'
    : 'GREEN'

  return { signals, overall, updatedAt: new Date() }
}

// RAG → existing token. Lime (--green/--t1 #94c864) is the Horiz0n positive.
export const RAG_COLOR = {
  green: '#94c864',
  amber: '#D4A853',
  red: '#ff4d6d',
}

// Day verdict reframe — no crisis red. Cyan for pressure/watch, lime for clear.
export function statusVerdict(overall) {
  if (overall === 'RED') return { label: 'HIGH PRESSURE', color: '#00d4e8' }
  if (overall === 'AMBER') return { label: 'ELEVATED WATCH', color: '#00d4e8' }
  return { label: 'ALL CLEAR', color: '#94c864' }
}

export function fmtClock(d = new Date()) {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function fmtDay(d = new Date()) {
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
}
