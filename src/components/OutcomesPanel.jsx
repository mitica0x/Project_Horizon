import { useState, useEffect, useCallback } from 'react'
import { fetchActivations, updateActivationOutcome } from '../lib/horizonStore'
import { Card, Badge, PanelHeader, EmptyState, FONT_HEAD, FONT_BODY, FONT_MONO } from './horizonUI'

// P4 — Campaign Outcome Tracking. Reads org-scoped rows from the activations
// table (written by P3). Field reads are defensive so a slightly different
// server schema still renders.

const DAY = 86400000

function val(a, ...keys) {
  for (const k of keys) if (a[k] != null) return a[k]
  return null
}

function displayStatus(a) {
  const outcome = val(a, 'outcome')
  if (outcome || val(a, 'outcome_status') === 'closed') return 'CLOSED'
  const ts = val(a, 'activated_at', 'created_at')
  const days = ts ? Math.floor((Date.now() - new Date(ts).getTime()) / DAY) : 0
  if (days < 14) return 'PENDING'
  return 'REVIEW DUE'
}

const STATUS_STYLE = {
  PENDING:      { color: '#8892a4', bg: 'rgba(255,255,255,0.04)', border: 'var(--border)' },
  'REVIEW DUE': { color: '#D4A853', bg: 'rgba(212,168,83,0.12)', border: 'rgba(212,168,83,0.35)' },
  CLOSED:       { color: '#94c864', bg: 'rgba(148,200,100,0.1)', border: 'rgba(148,200,100,0.35)' },
}

const OUTCOME_STYLE = {
  win:     { label: 'WIN',     color: '#94c864' },
  neutral: { label: 'NEUTRAL', color: '#8892a4' },
  miss:    { label: 'MISS',    color: '#ff4d6d' },
}

function daysSince(ts) {
  if (!ts) return 0
  return Math.floor((Date.now() - new Date(ts).getTime()) / DAY)
}

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function OutcomeRow({ a, onSaved }) {
  const status = displayStatus(a)
  const ss = STATUS_STYLE[status]
  const [note, setNote] = useState(val(a, 'outcome_note') || '')
  const [saving, setSaving] = useState(false)
  const [savedTick, setSavedTick] = useState(false)
  const outcome = val(a, 'outcome')

  const persist = async patch => {
    if (saving) return
    setSaving(true)
    const { data, error } = await updateActivationOutcome(a.id, patch)
    setSaving(false)
    if (!error) {
      setSavedTick(true)
      setTimeout(() => setSavedTick(false), 1800)
      onSaved(a.id, data ?? { ...a, ...patch })
    }
  }

  const saveNote = () => persist({ outcome_note: note })
  const setOutcome = o => persist({ outcome: o, outcome_status: 'closed', outcome_note: note })

  return (
    <Card style={{ padding: '16px 20px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 220, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span
              style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 15, color: 'var(--white)' }}
            >
              {val(a, 'event_name') || 'Untitled activation'}
            </span>
            <Badge color={ss.color} bg={ss.bg} border={ss.border}>
              {status}
            </Badge>
            {outcome && OUTCOME_STYLE[outcome] && (
              <Badge
                color={OUTCOME_STYLE[outcome].color}
                bg="transparent"
                border={OUTCOME_STYLE[outcome].color + '4d'}
              >
                {OUTCOME_STYLE[outcome].label}
              </Badge>
            )}
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: 'var(--text-muted)' }}>
            Activated {fmtDate(val(a, 'activated_at', 'created_at'))} ·{' '}
            {daysSince(val(a, 'activated_at', 'created_at'))}d ago
          </div>
          {val(a, 'note') && (
            <div
              style={{
                fontFamily: FONT_BODY,
                fontSize: 13,
                color: '#c8d0dc',
                marginTop: 6,
              }}
            >
              {val(a, 'note')}
            </div>
          )}
        </div>

        {status !== 'CLOSED' && (
          <div style={{ display: 'flex', gap: 8 }}>
            {(['win', 'neutral', 'miss']).map(o => (
              <button
                key={o}
                onClick={() => setOutcome(o)}
                disabled={saving}
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 10,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: OUTCOME_STYLE[o].color,
                  background: 'transparent',
                  border: `1px solid ${OUTCOME_STYLE[o].color}4d`,
                  borderRadius: 5,
                  padding: '6px 12px',
                  cursor: saving ? 'default' : 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => {
                  if (!saving) e.currentTarget.style.background = OUTCOME_STYLE[o].color + '14'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                {OUTCOME_STYLE[o].label}
              </button>
            ))}
          </div>
        )}
      </div>

      {status === 'REVIEW DUE' && !outcome && (
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            letterSpacing: '0.06em',
            color: '#D4A853',
            margin: '12px 0 4px',
          }}
        >
          ⚠ What happened? This activation is due for review.
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginTop: 12 }}>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          placeholder="Outcome note — what actually happened…"
          style={{
            flex: 1,
            boxSizing: 'border-box',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6,
            padding: '9px 12px',
            fontFamily: FONT_BODY,
            fontSize: 13,
            color: 'var(--white)',
            resize: 'vertical',
            outline: 'none',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = 'rgba(0,212,232,0.4)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
        />
        <button
          onClick={saveNote}
          disabled={saving}
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: savedTick ? '#94c864' : '#00d4e8',
            background: 'transparent',
            border: `1px solid ${savedTick ? 'rgba(148,200,100,0.4)' : 'rgba(0,212,232,0.35)'}`,
            borderRadius: 5,
            padding: '8px 14px',
            cursor: saving ? 'default' : 'pointer',
            whiteSpace: 'nowrap',
            transition: 'color 0.15s, border-color 0.15s',
          }}
        >
          {savedTick ? '✓ Saved' : saving ? '…' : 'Save'}
        </button>
      </div>
    </Card>
  )
}

export default function OutcomesPanel() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    const { data, error: e } = await fetchActivations()
    setRows(data || [])
    if (e && e !== 'no-org') setError(String(e))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const onSaved = (id, next) =>
    setRows(rs => rs.map(r => (r.id === id ? { ...r, ...next } : r)))

  const list = rows || []
  const activated = list.length
  const reviewDue = list.filter(a => displayStatus(a) === 'REVIEW DUE').length
  const wins = list.filter(a => val(a, 'outcome') === 'win').length
  const winRate = activated ? Math.round((wins / activated) * 100) : 0

  return (
    <>
      <PanelHeader
        title="Campaign Outcomes"
        accent="#94c864"
        count={activated}
        sub="Every activated window — track what the move actually returned"
      />

      {/* Summary bar */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          flexWrap: 'wrap',
          border: '1px solid var(--border)',
          borderRadius: 10,
          overflow: 'hidden',
          marginBottom: 20,
        }}
      >
        {[
          { k: 'Activated', v: activated, c: 'var(--cyan)' },
          { k: 'Review Due', v: reviewDue, c: '#D4A853' },
          { k: 'Wins', v: wins, c: '#94c864' },
          { k: 'Activation → Win', v: `${winRate}%`, c: '#94c864' },
        ].map((s, i) => (
          <div
            key={s.k}
            style={{
              flex: 1,
              minWidth: 130,
              padding: '16px 20px',
              borderLeft: i ? '1px solid var(--border)' : 'none',
              background: 'var(--bg-card)',
            }}
          >
            <div style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 22, color: s.c }}>
              {s.v}
            </div>
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 10,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                marginTop: 4,
              }}
            >
              {s.k}
            </div>
          </div>
        ))}
      </div>

      {rows === null ? (
        <EmptyState>Loading activations…</EmptyState>
      ) : error ? (
        <EmptyState>
          Could not reach activations ({error.slice(0, 80)}). Run migration 002 in Supabase.
        </EmptyState>
      ) : list.length === 0 ? (
        <EmptyState>
          No activations yet. Activate a window in WINDOWS to start tracking outcomes.
        </EmptyState>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {list.map(a => (
            <OutcomeRow key={a.id} a={a} onSaved={onSaved} />
          ))}
        </div>
      )}
    </>
  )
}
