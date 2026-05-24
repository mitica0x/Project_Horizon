import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { fetchDecisions } from '../lib/horizonStore'
import { assessCompetitors } from '../utils/horizonData'
import { intelKit } from '../utils/intelKit'
import { Card, Badge, PanelHeader, EmptyState, AskIntelButton, FONT_HEAD, FONT_BODY, FONT_MONO } from './horizonUI'

// P5 — Decision Ledger. Timeline of every activate / skip / defer, newest
// first. Skipped events that the field has since contested are flagged
// COMPETITORS MOVED (heuristic: current field pressure > pressure at decision).

// Event-type badge palette per spec — locked Mix4+Rust+Lime.
//   ACTIVATED ('RECOMMENDED' axis) → cyan
//   SKIPPED   ('ROUTINE')          → muted
//   DEFERRED  ('ELEVATED')         → lime
//   CRITICAL  (revisit-due / moves)→ red (true alert) — handled inline below
const DECISION_META = {
  activate: { label: 'RECOMMENDED', color: '#18b4d4', bg: 'rgba(24,180,212,0.10)', border: 'rgba(24,180,212,0.35)' },
  skip:     { label: 'ROUTINE',     color: '#8892a4', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.07)' },
  defer:    { label: 'ELEVATED',    color: '#70a848', bg: 'rgba(112,168,72,0.10)', border: 'rgba(112,168,72,0.35)' },
}

const FILTERS = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'activate', label: 'Activated', match: d => d.decision === 'activate' },
  { id: 'skip', label: 'Skipped', match: d => d.decision === 'skip' },
  { id: 'defer', label: 'Deferred', match: d => d.decision === 'defer' },
]

// Archival-log timestamp format: 2026.05.24_14:22_UTC (cyan monospace at the
// row level — colour is applied where it renders, not in the formatter).
function fmtWhen(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '—'
  const y = d.getUTCFullYear()
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${y}.${mo}.${day}_${hh}:${mm}_UTC`
}

function competitorsMoved(d, currentPressure) {
  if (d.decision !== 'skip') return false
  const snap =
    d.competitor_moves?.pressure ?? d.context_snapshot?.field?.pressure ?? null
  return snap != null && currentPressure > snap
}

function LedgerRow({ d, currentPressure }) {
  const [open, setOpen] = useState(false)
  const meta = DECISION_META[d.decision] || DECISION_META.skip
  const revisitDue =
    d.revisit_at && new Date(d.revisit_at).getTime() < Date.now()
  const moved = competitorsMoved(d, currentPressure)

  return (
    <Card style={{ padding: '14px 20px' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <Badge color={meta.color} bg={meta.bg} border={meta.border}>
          {meta.label}
        </Badge>
        <span
          style={{
            fontFamily: FONT_HEAD,
            fontWeight: 700,
            fontSize: 14,
            color: 'var(--white)',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {d.event_name || 'Untitled'}
        </span>
        {moved && (
          <Badge color="#ff4d6d" bg="rgba(255,77,109,0.12)" border="rgba(255,77,109,0.4)">
            Competitors moved
          </Badge>
        )}
        {revisitDue && (
          <Badge color="#ff4d6d" bg="rgba(255,77,109,0.10)" border="rgba(255,77,109,0.35)">
            CRITICAL · Revisit due
          </Badge>
        )}
        <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: '#18b4d4', letterSpacing: '0.04em' }}>
          {fmtWhen(d.decided_at)}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            const scanId = d.id || d.decision_id || (d.decided_at ? new Date(d.decided_at).getTime().toString(36) : 'archive')
            toast(`PARAMETERS RESTORED · ${scanId}`)
          }}
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#8892a4',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 3,
            padding: '5px 10px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'color 0.15s, border-color 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#b8c4d4'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#8892a4'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
        >
          Restore Parameters
        </button>
        <span style={{ color: meta.color, fontSize: 12 }}>{open ? '▾' : '▸'}</span>
      </button>

      {!open && d.rationale && (
        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: 12,
            color: 'var(--text-muted)',
            marginTop: 8,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {d.rationale}
        </div>
      )}

      {open && (
        <div
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {d.rationale && (
            <Field label="Rationale">{d.rationale}</Field>
          )}
          {d.context_snapshot && (
            <Field label="Context at decision">
              <pre
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  color: '#c8d0dc',
                  whiteSpace: 'pre-wrap',
                  margin: 0,
                }}
              >
                {JSON.stringify(d.context_snapshot, null, 2)}
              </pre>
            </Field>
          )}
          {d.competitor_moves && (
            <Field label="Competitor field at decision">
              <pre
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  color: '#c8d0dc',
                  whiteSpace: 'pre-wrap',
                  margin: 0,
                }}
              >
                {JSON.stringify(d.competitor_moves, null, 2)}
              </pre>
            </Field>
          )}
          {d.revisit_at && (
            <Field label="Revisit">
              {fmtWhen(d.revisit_at)}
              {d.revisit_note ? ` — ${d.revisit_note}` : ''}
            </Field>
          )}
        </div>
      )}
    </Card>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: '#c8d0dc', lineHeight: 1.6 }}>
        {children}
      </div>
    </div>
  )
}

export default function LedgerPanel({ onAskIntel, hideHeader = false }) {
  const [rows, setRows] = useState(null)
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const currentPressure = useMemo(() => assessCompetitors().pressure, [])

  useEffect(() => {
    fetchDecisions().then(({ data }) => setRows(data || []))
  }, [])

  const list = rows || []
  const fMatch = FILTERS.find(f => f.id === filter)?.match || (() => true)
  const filtered = list.filter(
    d =>
      fMatch(d) &&
      (!query ||
        (d.event_name || '').toLowerCase().includes(query.toLowerCase())),
  )

  const intelContext = () =>
    `You are reviewing the decision ledger. ${list.length} decision(s). Recent: ${list
      .slice(0, 5)
      .map(d => `${(d.decision || '').toUpperCase()} ${d.event_name || '—'}`)
      .join('; ') || 'none yet'}.`

  // Detect a simple shared trait among activated decisions, else null.
  const ledgerPattern = (() => {
    const acts = list.filter(d => d.decision === 'activate')
    if (acts.length < 3) return null
    const withRationale = acts.filter(d => (d.rationale || '').trim().length > 0).length
    if (withRationale / acts.length >= 0.6)
      return 'a written rationale logged at decision time'
    return null
  })()

  const askIntel = () =>
    onAskIntel(
      intelContext(),
      intelKit.ledger({ count: list.length, pattern: ledgerPattern }),
    )

  return (
    <>
      {!hideHeader && <PanelHeader
        title="Decision Ledger"
        accent="#18b4d4"
        count={list.length}
        sub="Every activate / skip / defer — the audit trail behind the moves"
        right={onAskIntel && <AskIntelButton onClick={askIntel} />}
      />}

      {/* Controls */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: 18,
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          {FILTERS.map(f => {
            const active = filter === f.id
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  color: active ? 'var(--cyan)' : 'var(--text-muted)',
                  background: active ? 'rgba(24,180,212,0.08)' : 'transparent',
                  border: `1px solid ${active ? 'rgba(24,180,212,0.35)' : 'var(--border)'}`,
                  borderRadius: 5,
                  padding: '7px 13px',
                  cursor: 'pointer',
                  transition: 'color 0.15s, border-color 0.15s, background 0.15s',
                }}
              >
                {f.label}
              </button>
            )
          })}
        </div>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by event name…"
          style={{
            flex: 1,
            minWidth: 200,
            boxSizing: 'border-box',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6,
            padding: '9px 13px',
            fontFamily: FONT_MONO,
            fontSize: 13,
            color: 'var(--white)',
            outline: 'none',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = 'rgba(24,180,212,0.4)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
        />
      </div>

      {rows === null ? (
        <EmptyState>Loading decisions…</EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState>
          {list.length === 0
            ? 'No decisions yet. Activate or dismiss an event in EVENTS.'
            : 'No decisions match this filter.'}
        </EmptyState>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(d => (
            <LedgerRow key={d.id} d={d} currentPressure={currentPressure} />
          ))}
        </div>
      )}
    </>
  )
}
