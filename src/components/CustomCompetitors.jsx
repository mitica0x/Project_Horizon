import { useState, useEffect, useRef, useCallback } from 'react'
import { getActiveOrgId } from '../lib/supabase'
import { fetchCompetitors, updateCompetitors } from '../api/competitors'

const MAX_CUSTOM = 10

const FONT_MONO = 'var(--font-mono)'

// Locked default competitor — muted, no remove, not interactive.
const lockedChip = {
  fontFamily: FONT_MONO,
  fontSize: 12,
  lineHeight: 1,
  padding: '4px 9px',
  borderRadius: 4,
  background: 'rgba(255,255,255,0.03)',
  color: 'var(--text-muted)',
  border: '1px solid var(--border)',
  cursor: 'default',
  whiteSpace: 'nowrap',
}

// User-added competitor — teal, removable.
const customChip = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontFamily: FONT_MONO,
  fontSize: 12,
  lineHeight: 1,
  padding: '4px 9px',
  borderRadius: 4,
  background: 'var(--cyan-dim)',
  color: 'var(--cyan)',
  border: '1px solid rgba(0,212,232,0.35)',
  whiteSpace: 'nowrap',
}

const addChip = {
  fontFamily: FONT_MONO,
  fontSize: 12,
  lineHeight: 1,
  padding: '4px 10px',
  borderRadius: 4,
  background: 'transparent',
  color: 'var(--cyan)',
  border: '1px solid rgba(0,212,232,0.45)',
  cursor: 'pointer',
  transition: 'all .15s',
}

/**
 * COMPETITORS management — the locked default 12 (display-only) plus the
 * org's editable custom set. Self-contained: resolves its own org id from
 * the post-login auth context (getActiveOrgId, which populates async) and
 * talks to the backend directly, so it stays additive to the dashboard.
 */
export default function CustomCompetitors() {
  const [orgId, setOrgId] = useState(getActiveOrgId())
  const [set, setSet] = useState({ defaults: [], custom: [] })
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  // Guards the input's onBlur from double-firing a save after Enter/Escape.
  const settled = useRef(false)

  // org id resolves a tick or two after login — poll until it lands.
  useEffect(() => {
    if (orgId) return
    const t = setInterval(() => {
      const id = getActiveOrgId()
      if (id) {
        setOrgId(id)
        clearInterval(t)
      }
    }, 500)
    return () => clearInterval(t)
  }, [orgId])

  useEffect(() => {
    if (!orgId) return
    let live = true
    fetchCompetitors(orgId).then(s => {
      if (live) setSet(s)
    })
    return () => {
      live = false
    }
  }, [orgId])

  const commit = useCallback(
    async next => {
      if (!orgId) return
      setBusy(true)
      const updated = await updateCompetitors(orgId, next)
      if (updated) setSet(updated)
      setBusy(false)
    },
    [orgId],
  )

  const addCompetitor = useCallback(() => {
    const name = draft.trim().toLowerCase()
    setAdding(false)
    setDraft('')
    // Empty inputs are silently ignored. Backend dedupes, so no client check.
    if (!name || busy) return
    if (set.custom.length >= MAX_CUSTOM) return
    commit([...set.custom, name])
  }, [draft, busy, set.custom, commit])

  const removeCompetitor = useCallback(
    name => {
      if (busy) return
      commit(set.custom.filter(c => c !== name))
    },
    [busy, set.custom, commit],
  )

  const atLimit = set.custom.length >= MAX_CUSTOM

  return (
    <div
      style={{
        marginBottom: 20,
        paddingBottom: 20,
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 12,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--cyan)',
          }}
        >
          Competitors
        </span>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            color: 'var(--text-muted)',
          }}
        >
          12 locked defaults · add up to {MAX_CUSTOM} of your own
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {set.defaults.map(name => (
          <span key={`d-${name}`} style={lockedChip} title="Default competitor">
            {name}
          </span>
        ))}

        {set.custom.map(name => (
          <span key={`c-${name}`} style={customChip}>
            {name}
            <button
              type="button"
              aria-label={`Remove ${name}`}
              title={`Remove ${name}`}
              onClick={() => removeCompetitor(name)}
              disabled={busy}
              style={{
                fontFamily: FONT_MONO,
                fontSize: 13,
                lineHeight: 1,
                padding: 0,
                border: 'none',
                background: 'transparent',
                color: 'var(--cyan)',
                cursor: busy ? 'default' : 'pointer',
              }}
            >
              ×
            </button>
          </span>
        ))}

        {atLimit ? (
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 12,
              lineHeight: 1,
              padding: '4px 9px',
              color: 'var(--text-muted)',
            }}
          >
            {MAX_CUSTOM}/{MAX_CUSTOM} max
          </span>
        ) : adding ? (
          <input
            type="text"
            autoFocus
            value={draft}
            placeholder="Competitor name"
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                settled.current = true
                addCompetitor()
              } else if (e.key === 'Escape') {
                settled.current = true
                setAdding(false)
                setDraft('')
              }
            }}
            onBlur={() => {
              if (settled.current) {
                settled.current = false
                return
              }
              addCompetitor()
            }}
            style={{
              fontFamily: FONT_MONO,
              fontSize: 12,
              lineHeight: 1,
              padding: '4px 9px',
              width: 150,
              background: 'var(--bg-card-hover)',
              border: '1px solid rgba(0,212,232,0.45)',
              borderRadius: 4,
              color: 'var(--white)',
              outline: 'none',
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              settled.current = false
              setDraft('')
              setAdding(true)
            }}
            disabled={busy}
            style={addChip}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--cyan-dim)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            + Add
          </button>
        )}
      </div>
    </div>
  )
}
