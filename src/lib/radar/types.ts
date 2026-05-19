export type EventCategory = 'sports' | 'web3' | 'business' | 'cultural'
export type EventPriority = 'high' | 'medium' | 'low'
export interface RadarEvent { id: number; name: string; sub: string; date: string; cat: EventCategory; pri: EventPriority; score: number; audience?: string; geo: string; tags?: string[] }
export type AlertStatus = 'missed' | 'last-chance' | 'act-now' | 'urgent' | 'brief-window' | 'on-radar'
export interface AlertInfo { status: AlertStatus; label: string; daysOut: number }
export type Verdict = 'move' | 'consider' | 'skip'
export type ScoreFactorKey = 'audience_overlap' | 'competitor_gap' | 'activation_cost' | 'timing_window' | 'historical_signal'
export interface ScoreFactor { score: number; reason: string }
export type PresenceOptionType = 'content' | 'paid' | 'partner'
export type UserConstraints = { budget: 'low' | 'mid' | 'high'; capabilities: Array<'content' | 'paid' | 'partner'> }
export interface PresenceOption { type: PresenceOptionType; description: string }
export interface PresenceBrief { verdict: Verdict; verdict_reason: string; why_bybit: string; score_breakdown: Record<ScoreFactorKey, ScoreFactor>; presence_options: PresenceOption[]; campaign_hook: string; downside: string; deadline_note: string; priority: 'high' | 'medium' | 'low' }
export interface BriefParseError { error: 'parse_failed'; raw: string }
