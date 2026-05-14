import type { RadarEvent, AlertInfo, AlertStatus } from './types'

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
