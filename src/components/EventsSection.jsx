import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { RADAR_EVENTS } from '../lib/radar/events'
import {
  filterEvents,
  groupByMonth,
  fmtMonth,
  computeLivingScore,
  getAlertInfo,
} from '../lib/radar/scoring'
import { assessCompetitors } from '../lib/radar/competitors'
import {
  fetchDetectedEvents,
  confirmDetectedEvent,
  dismissDetectedEvent,
  fetchDetectionSettings,
  runDetectNow,
  detectedSyntheticId,
} from '../api/detection'

// ─── Tokens (locked Mix4+Rust+Lime palette) ───────────────────────────────────
const COLOR = {
  emerald:   '#0dbe82', emeraldRgb: '13,190,130',
  lime:      '#70a848', limeRgb:    '112,168,72',
  cyan:      '#18b4d4', cyanRgb:    '24,180,212',
  rust:      '#e8703a', rustRgb:    '232,112,58',
  body:      '#b8c4d4',
  muted:     '#8892a4',
  card:      '#0f1422',
  border:    'rgba(255,255,255,0.07)',
  borderSub: 'rgba(255,255,255,0.05)',
  white:     '#ffffff',
}
const MONO = "'Geist Mono', monospace"
const TYPE_TO_CAT = { sports:'sports', web3:'web3', cultural:'cultural', business:'business', regulatory:'business', other:'business' }

// ─── Filter constants (existing logic — unchanged) ─────────────────────────────
const BUDGETS = [
  { key:'low',  label:'LOW <€20k' },
  { key:'mid',  label:'MID €20–100k' },
  { key:'high', label:'HIGH >€100k' },
]
const CAPABILITIES = [
  { key:'content', label:'Content' },
  { key:'paid',    label:'Paid' },
  { key:'partner', label:'Partner' },
]
const CATS = ['all', 'sports', 'web3', 'business', 'cultural']

// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysUntil(d) {
  return Math.round((new Date(d) - new Date()) / 86400000)
}

function fmtDateParts(d) {
  const [year, m, day] = d.split('-')
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  return { day, month: months[+m - 1] || '', year }
}

// Threat windows (rust) override the verdict-driven action; otherwise verdict
// drives the accent. Returns { label, color, rgb } for the action tag, the
// left-border accent, and the countdown badge background.
function deriveAction(verdict, alertStatus) {
  if (alertStatus === 'missed' || alertStatus === 'last-chance') {
    return { label: alertStatus === 'missed' ? 'GAP' : 'URGENT', color: COLOR.rust, rgb: COLOR.rustRgb }
  }
  if (verdict === 'move')     return { label: 'MOVE',     color: COLOR.emerald, rgb: COLOR.emeraldRgb }
  if (verdict === 'consider') return { label: 'CONSIDER', color: COLOR.lime,    rgb: COLOR.limeRgb }
  return { label: 'WATCH', color: COLOR.cyan, rgb: COLOR.cyanRgb }
}

// Intel pill is conditional — surfaces only when the alert window is
// actionable now (cyan) or already closing (rust).
function deriveIntelPill(alertStatus) {
  if (alertStatus === 'urgent' || alertStatus === 'act-now') {
    return { text: 'Urgent — brief window', color: COLOR.cyan, rgb: COLOR.cyanRgb }
  }
  if (alertStatus === 'last-chance') {
    return { text: 'Threat — last chance to act', color: COLOR.rust, rgb: COLOR.rustRgb }
  }
  if (alertStatus === 'missed') {
    return { text: 'Threat — window missed', color: COLOR.rust, rgb: COLOR.rustRgb }
  }
  return null
}

// ─── Filter chip primitives ───────────────────────────────────────────────────
const chipBase = {
  fontFamily: MONO,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  padding: '5px 11px',
  borderRadius: 3,
  cursor: 'pointer',
  lineHeight: 1,
  transition: 'background 0.15s, border-color 0.15s, color 0.15s',
}
const chipInactive = {
  ...chipBase,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'transparent',
  color: COLOR.muted,
}
// Category filter active state — cyan (filter / intel-data axis).
const chipActiveCategory = {
  ...chipBase,
  border: `1px solid ${COLOR.cyan}`,
  background: `rgba(${COLOR.cyanRgb},0.07)`,
  color: COLOR.cyan,
}
// Constraint filter active state — cyan (filter / intel-data axis).
const chipActiveConstraint = {
  ...chipBase,
  border: `1px solid ${COLOR.cyan}`,
  background: `rgba(${COLOR.cyanRgb},0.07)`,
  color: COLOR.cyan,
}

// ─── Card — full-width horizontal ─────────────────────────────────────────────
function EventCard({ event, verdict, alert, action, intel, score, index, onActivate, onDismiss }) {
  const dp = fmtDateParts(event.date)
  const dOut = daysUntil(event.date)
  const countdown = dOut < 0 ? 'PAST' : dOut === 0 ? 'TODAY' : `T-${dOut}D`

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2, ease: 'easeOut' }}
      style={{
        display: 'grid',
        gridTemplateColumns: '72px 1fr auto',
        background: COLOR.card,
        border: `1px solid ${COLOR.border}`,
        borderLeft: `3px solid ${action.color}`,
        borderRadius: 3,
        marginTop: 6,
        overflow: 'hidden',
      }}
    >
      {/* ── Column 1 — date + countdown ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px 8px',
          borderRight: `1px solid ${COLOR.borderSub}`,
          gap: 2,
        }}
      >
        <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: COLOR.body, letterSpacing: '0.04em' }}>
          {dp.month} {dp.day}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 9, color: COLOR.muted }}>{dp.year}</div>
        <div
          style={{
            marginTop: 4,
            fontFamily: MONO,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.05em',
            padding: '2px 5px',
            borderRadius: 3,
            background: `rgba(${action.rgb},0.14)`,
            color: action.color,
            border: `1px solid rgba(${action.rgb},0.3)`,
          }}
        >
          {countdown}
        </div>
      </div>

      {/* ── Column 2 — title + tags + description + intel pill ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 16px', minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLOR.white, letterSpacing: '-0.01em', lineHeight: 1.3 }}>
          {event.name}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <Tag label={event.cat} color={COLOR.muted} rgb="136,146,164" />
          <Tag label={action.label} color={action.color} rgb={action.rgb} />
          <Tag label={alert.label} color={COLOR.muted} rgb="136,146,164" />
        </div>
        {event.sub && (
          <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.5 }}>
            {event.sub}
          </div>
        )}
        {intel && (
          <div
            style={{
              alignSelf: 'flex-start',
              fontFamily: MONO,
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '3px 8px',
              borderRadius: 3,
              background: `rgba(${intel.rgb},0.08)`,
              color: intel.color,
              border: `1px solid rgba(${intel.rgb},0.35)`,
            }}
          >
            {intel.text}
          </div>
        )}
      </div>

      {/* ── Column 3 — score + actions ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 12,
          padding: '14px 16px',
          borderLeft: `1px solid ${COLOR.borderSub}`,
          minWidth: 140,
        }}
      >
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: MONO, lineHeight: 1 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: COLOR.white }}>{score}</span>
            <span style={{ fontSize: 11, color: COLOR.muted }}>/10</span>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: COLOR.muted, letterSpacing: '0.1em', marginTop: 4 }}>
            RELEVANCE
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <button
            onClick={onActivate}
            style={{
              fontFamily: MONO,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '6px 14px',
              borderRadius: 3,
              border: 'none',
              background: COLOR.emerald,
              color: '#062017',
              cursor: 'pointer',
            }}
          >
            Activate
          </button>
          <button
            onClick={onDismiss}
            style={{
              fontFamily: MONO,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '6px 14px',
              borderRadius: 3,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent',
              color: COLOR.muted,
              cursor: 'pointer',
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </motion.div>
  )
}

function Tag({ label, color, rgb }) {
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        padding: '2px 7px',
        borderRadius: 3,
        background: `rgba(${rgb},0.06)`,
        color,
        border: `1px solid rgba(${rgb},0.3)`,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

// ─── Month block ──────────────────────────────────────────────────────────────
function MonthBlock({ month, events, defaultOpen, computeVerdict, onActivate, onDismiss }) {
  const [open, setOpen] = useState(defaultOpen)
  const [expanded, setExpanded] = useState(false)
  const [hover, setHover] = useState(false)

  const enriched = useMemo(
    () =>
      events.map((e) => {
        const verdict = computeVerdict(e)
        const alert = getAlertInfo(e.date)
        return {
          event: e,
          verdict,
          alert,
          action: deriveAction(verdict, alert.status),
          intel: deriveIntelPill(alert.status),
          score: e.score ?? Math.round(
            computeLivingScore(e, { budget: 'mid', capabilities: ['content', 'paid', 'partner'] }, assessCompetitors(e, { budget: 'mid', capabilities: ['content', 'paid', 'partner'] })).adjustedTotal,
          ),
        }
      }),
    [events, computeVerdict],
  )

  const moveCount = enriched.filter((x) => x.verdict === 'move').length
  const visible = expanded ? enriched : enriched.slice(0, 3)
  const remaining = enriched.length - visible.length

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Month header */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o) } }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          alignItems: 'center',
          gap: 16,
          padding: '12px 0',
          borderBottom: `1px solid ${COLOR.borderSub}`,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            fontFamily: MONO,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: hover ? COLOR.body : COLOR.muted,
            transition: 'color 0.15s',
          }}
        >
          {month}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
          <SummaryPill
            label={`${enriched.length} event${enriched.length === 1 ? '' : 's'}`}
            color={COLOR.muted}
            rgb="136,146,164"
          />
          {moveCount > 0 && (
            <SummaryPill
              label={`${moveCount} high priority`}
              color={COLOR.emerald}
              rgb={COLOR.emeraldRgb}
            />
          )}
        </div>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ display: 'inline-flex', color: COLOR.muted }}
        >
          <ChevronDown size={14} strokeWidth={1.75} />
        </motion.div>
      </div>

      {/* Month body */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ paddingTop: 6 }}>
              {visible.map((row, i) => (
                <EventCard
                  key={row.event.id}
                  event={row.event}
                  verdict={row.verdict}
                  alert={row.alert}
                  action={row.action}
                  intel={row.intel}
                  score={row.score}
                  index={i}
                  onActivate={() => onActivate(row.event)}
                  onDismiss={() => onDismiss(row.event)}
                />
              ))}
              {remaining > 0 && !expanded && (
                <button
                  onClick={() => setExpanded(true)}
                  style={{
                    display: 'block',
                    width: '100%',
                    marginTop: 6,
                    padding: 8,
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 3,
                    color: COLOR.muted,
                    fontFamily: MONO,
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'color 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = COLOR.body
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.16)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = COLOR.muted
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                  }}
                >
                  + {remaining} more event{remaining === 1 ? '' : 's'}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SummaryPill({ label, color, rgb }) {
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        padding: '3px 8px',
        borderRadius: 3,
        background: `rgba(${rgb},0.08)`,
        color,
        border: `1px solid rgba(${rgb},0.25)`,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

// ─── Top constraint bar ───────────────────────────────────────────────────────
function ConstraintBar({ constraints, onChange }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        flexWrap: 'wrap',
        padding: '12px 0',
        marginBottom: 12,
        borderBottom: `1px solid ${COLOR.border}`,
      }}
    >
      <span style={{ fontFamily: MONO, fontSize: 10, color: COLOR.muted, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
        Constraints
      </span>
      <div style={{ display: 'flex', gap: 6 }}>
        {BUDGETS.map((b) => (
          <button
            key={b.key}
            onClick={() => onChange({ ...constraints, budget: b.key })}
            style={constraints.budget === b.key ? chipActiveConstraint : chipInactive}
          >
            {b.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {CAPABILITIES.map((c) => {
          const active = constraints.capabilities.includes(c.key)
          return (
            <button
              key={c.key}
              onClick={() => {
                const caps = active
                  ? constraints.capabilities.filter((x) => x !== c.key)
                  : [...constraints.capabilities, c.key]
                onChange({ ...constraints, capabilities: caps })
              }}
              style={active ? chipActiveConstraint : chipInactive}
            >
              {c.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function EventsSection({ orgId }) {
  const [constraints, setConstraints] = useState({ budget: 'mid', capabilities: ['content', 'paid', 'partner'] })
  const [dismissed, setDismissed] = useState(new Set())
  const [detected, setDetected] = useState([])
  // settings retained for future use; not surfaced in this layout.
  // eslint-disable-next-line no-unused-vars
  const [settings, setSettings] = useState(null)
  const [catFilter, setCatFilter] = useState('all')
  const [highOnly, setHighOnly] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [detectCount, setDetectCount] = useState(null)

  useEffect(() => {
    if (!orgId) return
    fetchDetectedEvents(orgId).then(setDetected).catch(() => {})
    fetchDetectionSettings(orgId).then(setSettings).catch(() => {})
  }, [orgId])

  const detectedAsRadar = detected
    .filter((d) => !d.dismissed)
    .map((d) => ({
      id: detectedSyntheticId(d.id),
      _detectedId: d.id,
      name: d.title,
      sub: d.reasoning,
      date: d.detected_at.split('T')[0],
      cat: TYPE_TO_CAT[d.event_type] || 'business',
      pri: d.urgency === 'immediate' ? 'high' : d.urgency === 'upcoming' ? 'medium' : 'low',
      score: Math.round(d.confidence / 10),
      geo: 'Global',
      tags: [],
      _confidence: d.confidence,
      _sourceName: d.source_name,
      _confirmed: d.confirmed,
    }))

  const allEvents = [...detectedAsRadar, ...RADAR_EVENTS]
  const filtered = filterEvents(allEvents, catFilter, highOnly).filter((e) => !dismissed.has(e.id))

  // groupByMonth preserves insertion order; sort the entries chronologically
  // by the earliest date in each group so months render oldest-first and the
  // "current/earliest month" rule is unambiguous.
  const grouped = useMemo(() => {
    const map = groupByMonth(filtered)
    const entries = [...map.entries()].sort((a, b) => {
      const dateA = a[1].reduce((min, e) => (e.date < min ? e.date : min), a[1][0]?.date ?? '9999')
      const dateB = b[1].reduce((min, e) => (e.date < min ? e.date : min), b[1][0]?.date ?? '9999')
      return dateA.localeCompare(dateB)
    })
    return entries
  }, [filtered])

  const computeVerdict = useCallback(
    (event) => {
      const living = computeLivingScore(event, constraints, assessCompetitors(event, constraints))
      if (living.adjustedTotal >= 8) return 'move'
      if (living.adjustedTotal >= 6) return 'consider'
      return 'skip'
    },
    [constraints],
  )

  const handleDismiss = useCallback((event) => {
    setDismissed((prev) => new Set([...prev, event.id]))
    if (event._detectedId) dismissDetectedEvent(event._detectedId).catch(() => {})
  }, [])

  const handleActivate = useCallback((event) => {
    if (event._detectedId) confirmDetectedEvent(event._detectedId).catch(() => {})
  }, [])

  const handleDetectNow = useCallback(async () => {
    if (!orgId || detecting) return
    setDetecting(true)
    setDetectCount(null)
    try {
      const n = await runDetectNow(orgId)
      setDetectCount(n)
      const fresh = await fetchDetectedEvents(orgId)
      setDetected(fresh)
    } catch { /* network — surface via UI count remaining null */ }
    setDetecting(false)
  }, [orgId, detecting])

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: COLOR.white, letterSpacing: '-0.01em' }}>EVENTS</div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: COLOR.muted, marginTop: 4 }}>
            {filtered.length} events · 180-day window
          </div>
        </div>
        <button
          onClick={handleDetectNow}
          disabled={detecting}
          style={{
            fontFamily: MONO,
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '8px 16px',
            borderRadius: 3,
            border: `1px solid ${COLOR.cyan}`,
            background: 'transparent',
            color: COLOR.cyan,
            cursor: detecting ? 'default' : 'pointer',
            opacity: detecting ? 0.5 : 1,
          }}
        >
          {detecting ? 'Detecting…' : detectCount !== null ? `+${detectCount} detected` : 'Detect Now'}
        </button>
      </div>

      {/* Filters */}
      <ConstraintBar constraints={constraints} onChange={setConstraints} />

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {CATS.map((c) => (
          <button
            key={c}
            onClick={() => setCatFilter(c)}
            style={catFilter === c ? chipActiveCategory : chipInactive}
          >
            {c}
          </button>
        ))}
        <button
          onClick={() => setHighOnly((h) => !h)}
          style={highOnly ? chipActiveCategory : chipInactive}
        >
          High priority only
        </button>
      </div>

      {/* Feed */}
      {filtered.length === 0 ? (
        <div style={{ fontFamily: MONO, fontSize: 12, color: COLOR.muted, textAlign: 'center', padding: '60px 0' }}>
          No events match current filters.
        </div>
      ) : (
        grouped.map(([month, events], i) => (
          <MonthBlock
            key={month}
            month={month.toUpperCase()}
            events={events}
            defaultOpen={i === 0}
            computeVerdict={computeVerdict}
            onActivate={handleActivate}
            onDismiss={handleDismiss}
          />
        ))
      )}
    </div>
  )
}
