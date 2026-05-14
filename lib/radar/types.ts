export type EventCategory = 'sports' | 'web3' | 'business' | 'cultural'
export type EventPriority = 'high' | 'medium' | 'low'

export interface RadarEvent {
  id: number
  name: string
  sub: string
  date: string // ISO YYYY-MM-DD
  cat: EventCategory
  pri: EventPriority
  score: number // 1-10, Bybit relevance
  audience: string
  geo: string
}

export type AlertStatus =
  | 'missed'       // past
  | 'last-chance'  // 0-7 days
  | 'act-now'      // 8-14 days
  | 'urgent'       // 15-29 days
  | 'brief-window' // 30-60 days — optimal
  | 'on-radar'     // 61-100 days

export interface AlertInfo {
  status: AlertStatus
  label: string
  daysOut: number
}

export interface PresenceBrief {
  why_bybit: string
  presence_options: [string, string, string]
  hook: string
  deadline_note: string
  priority_line: string
}
