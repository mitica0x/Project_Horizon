import type { RadarEvent, AlertInfo, AlertStatus, ScoreFactorKey, UserConstraints } from './types'
import type { CompetitorAssessment } from './competitors'

const BASE_DATE = new Date()

export function daysUntil(dateStr: string): number {
  return Math.round((new Date(dateStr).getTime() - BASE_DATE.getTime()) / 86400000)
}

export function getAlertInfo(dateStr: string): AlertInfo {
  const daysOut = daysUntil(dateStr)
  let status: AlertStatus
  let label: string

  if (daysOut < 0)       { status = 'missed';       label = 'Window missed' }
  else if (daysOut <= 7) { status = 'last-chance';  label = 'Last chance' }
  else if (daysOut <= 14){ status = 'act-now';      label = 'Act now' }
  else if (daysOut <= 29){ status = 'urgent';       label = 'Urgent — brief' }
  else if (daysOut <= 60){ status = 'brief-window'; label = 'Brief window ⚡' }
  else                   { status = 'on-radar';     label = 'On radar' }

  return { status, label, daysOut }
}

export function fmtDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[+m - 1]} ${d}`
}

export function fmtMonth(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en', { month: 'long', year: 'numeric' })
}

export function filterEvents(
  events: RadarEvent[],
  category: string,
  highOnly: boolean
): RadarEvent[] {
  return events.filter(e => {
    if (daysUntil(e.date) < -1) return false
    if (highOnly && e.pri !== 'high') return false
    if (category !== 'all' && e.cat !== category) return false
    return true
  })
}

export function groupByMonth(events: RadarEvent[]): Map<string, RadarEvent[]> {
  const map = new Map<string, RadarEvent[]>()
  events.forEach(e => {
    const key = fmtMonth(e.date)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(e)
  })
  return map
}

export function getBriefWindowCount(events: RadarEvent[]): number {
  return events.filter(e => {
    const d = daysUntil(e.date)
    return d >= 30 && d <= 60
  }).length
}

export function getNextEvent(events: RadarEvent[]): RadarEvent | undefined {
  return events.find(e => daysUntil(e.date) >= 0)
}

/**
 * Re-score a single factor against operator constraints. Additive layer on
 * top of the static event/factor score — does NOT replace any existing
 * scoring path. Only `activation_cost` reacts to budget; every other factor
 * is returned unchanged.
 *
 *   activation_cost · LOW  budget → −2 (floor 1)
 *   activation_cost · MID  budget →  0
 *   activation_cost · HIGH budget → +1 (ceiling 10)
 */
export function applyConstraintModifier(
  score: number,
  factor: ScoreFactorKey,
  constraints: UserConstraints
): number {
  if (factor !== 'activation_cost') return score
  if (constraints.budget === 'low')  return Math.max(1, score - 2)
  if (constraints.budget === 'high') return Math.min(10, score + 1)
  return score
}

export type LivingScoreModifiers = {
  competitorPressure: number   // -2 to +2
  windowUrgency: number        // 0 to +3 as T-minus shrinks
  fieldOpenness: number        // +1 if 0 competitors, -1 if 3+
  adjustedTotal: number        // constraint-adjusted base + modifiers, [1,10]
  triggers: string[]           // human-readable causes of the adjustment
}

/**
 * Layers competitor pressure and window urgency on top of the
 * constraint-adjusted score. Pure/deterministic — same inputs, same output.
 * Base = applyConstraintModifier(score, 'activation_cost', constraints).
 */
export function computeLivingScore(
  event: RadarEvent,
  constraints: UserConstraints,
  competitors: CompetitorAssessment[]
): LivingScoreModifiers {
  const base = applyConstraintModifier(event.score, 'activation_cost', constraints)
  const likely = competitors.filter(c => c.likelyActivated)
  const nLikely = likely.length
  const nHigh = likely.filter(c => c.confidence === 'high').length
  const t = daysUntil(event.date)

  // competitorPressure: 3+ high-confidence → -1, 0 likely → +2, 1 → 0.
  // (2 likely with <3 high-confidence is unspecified → neutral, in range.)
  let competitorPressure = 0
  if (nHigh >= 3) competitorPressure = -1
  else if (nLikely === 0) competitorPressure = 2
  else if (nLikely === 1) competitorPressure = 0

  // windowUrgency: <14 → +2, 14-30 → +1, >30 → 0.
  let windowUrgency = 0
  if (t < 14) windowUrgency = 2
  else if (t <= 30) windowUrgency = 1

  // fieldOpenness: 0 likely → +1, 3+ likely → -1.
  let fieldOpenness = 0
  if (nLikely === 0) fieldOpenness = 1
  else if (nLikely >= 3) fieldOpenness = -1

  const triggers: string[] = []
  if (fieldOpenness > 0) triggers.push(`+ Field open (+${fieldOpenness})`)
  if (fieldOpenness < 0) triggers.push(`- Crowded field (${fieldOpenness})`)
  if (competitorPressure > 0) triggers.push(`+ Open field (+${competitorPressure})`)
  if (competitorPressure < 0) triggers.push(`- Competitor pressure (${competitorPressure})`)
  if (windowUrgency >= 2) triggers.push(`+ Window urgent (+${windowUrgency})`)
  else if (windowUrgency === 1) triggers.push(`+ Active window (+${windowUrgency})`)

  const adjustedTotal = Math.max(
    1,
    Math.min(10, base + competitorPressure + windowUrgency + fieldOpenness)
  )

  return { competitorPressure, windowUrgency, fieldOpenness, adjustedTotal, triggers }
}
