import { useState, useEffect, useMemo } from 'react'
import { fetchDecisions } from '../lib/horizonStore'
import { assessCompetitors } from '../utils/horizonData'
import { intelKit } from '../utils/intelKit'
import { Card, Badge, PanelHeader, EmptyState, AskIntelButton, FONT_HEAD, FONT_BODY, FONT_MONO } from './horizonUI'

// P5 — Decision Ledger. Timeline of every activate / skip / defer, newest
// first. Skipped events that the field has since contested are flagged
// COMPETITORS MOVED (heuristic: current field pressure > pressure at decision).

const DECISION_META = {
  activate: { label: 'ACTIVATED', color: '#94c864', bg: 'rgba(148,200,100,0.12)', border: 'rgba(148,200,100,0.35)' },
  skip:     { label: 'SKIPPED',   color: '#8892a4', bg: 'rgba(255,255,255,0.04)', border: 'var(--border)' },
  defer:    { label: 'DEFERRED',  color: '#D4A853', bg: 'rgba(212,168,83,0.12)', border: 'rgba(212,168,83,0.35)' },
}

const FILTERS = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'activate', label: 'Activated', match: d => d.decision === 'activate' },
  { id: 'skip', label: 'Skipped', match: d => d.decision === 'skip' },
  { id: 'defer', label: 'Deferred', match: d => d.decision === 'defer' },
]

function fmtWhen(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
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
          <Badge color="#D4A853" bg="rgba(212,168,83,0.12)" border="rgba(212,168,83,0.35)">
            Revisit due
          </Badge>
        )}
        <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: 'var(--text-muted)' }}>
          {fmtWhen(d.decided_at)}
        </span>
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

export default function LedgerPanel({ onAskIntel }) {
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
      <PanelHeader
        title="Decision Ledger"
        accent="#00d4e8"
        count={list.length}
        sub="Every activate / skip / defer — the audit trail behind the moves"
        right={onAskIntel && <AskIntelButton onClick={askIntel} />}
      />

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
                  background: active ? 'rgba(0,212,232,0.08)' : 'transparent',
                  border: `1px solid ${active ? 'rgba(0,212,232,0.35)' : 'var(--border)'}`,
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
          onFocus={e => (e.currentTarget.style.borderColor = 'rgba(0,212,232,0.4)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
        />
      </div>

      {rows === null ? (
        <EmptyState>Loading decisions…</EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState>
          {list.length === 0
            ? 'No decisions yet. Activate or dismiss a window in WINDOWS.'
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
