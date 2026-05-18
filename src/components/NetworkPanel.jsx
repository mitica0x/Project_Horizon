import { useState, useEffect, useMemo, useCallback } from 'react'
import { useOrg } from '../context/OrgContext'
import { GAPS_T1 } from '../data/staticData'
import { intelKit } from '../utils/intelKit'
import {
  Card,
  Badge,
  PanelHeader,
  AskIntelButton,
  FONT_BODY,
  FONT_MONO,
} from './horizonUI'

// P9 — Network Intelligence, rebuilt as contact intelligence mapped to the
// live T1 gap list. Contacts persist to localStorage; Gmail sync is the
// next-phase automation (surfaced as coming-soon). One DIRECT contact is
// seeded for the Bybit EU demo org so the page reads as live on load.

const CONTACTS_KEY = 'horizon_network_contacts'
const DEMO_ORG_SLUG = 'bybit-eu'
const GMAIL_CONNECTED_KEY = 'gmail_connected'

const WARMTH = ['DIRECT', 'WARM PATH', 'COLD']

function urlPath(url) {
  const d = url.split('/')[0]
  const rest = url.slice(d.length)
  return rest && rest !== '/' ? rest : ''
}

function geoLabel(country) {
  if (!country || country === 'GLOBAL') return 'Global'
  if (country === 'UK' || country === 'GB') return 'UK'
  return country
}

function readContacts() {
  try {
    const v = JSON.parse(localStorage.getItem(CONTACTS_KEY) || 'null')
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

function writeContacts(map) {
  try {
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(map))
  } catch {
    /* storage blocked — non-fatal, in-memory state still holds */
  }
}

// Badge derivation: DIRECT warmth → DIRECT (lime); any other recorded
// contact → WARM (amber); none → caller renders the + ADD CONTACT button.
function badgeFor(contact) {
  if (!contact) return null
  if (contact.warmth === 'DIRECT')
    return { label: 'DIRECT', color: '#94c864', bg: 'rgba(148,200,100,0.12)', border: 'rgba(148,200,100,0.4)' }
  return { label: 'WARM', color: '#D4A853', bg: 'rgba(212,168,83,0.12)', border: 'rgba(212,168,83,0.4)' }
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 6,
  padding: '9px 12px',
  fontFamily: FONT_BODY,
  fontSize: 13,
  color: 'var(--white)',
  outline: 'none',
}

const labelStyle = {
  display: 'block',
  fontFamily: FONT_MONO,
  fontSize: 10,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  marginBottom: 6,
}

function ContactForm({ gap, initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || '')
  const [role, setRole] = useState(initial?.role || '')
  const [company, setCompany] = useState(initial?.company || gap.domain)
  const [how, setHow] = useState(initial?.how || '')
  const [warmth, setWarmth] = useState(initial?.warmth || 'WARM PATH')

  const save = () => {
    if (!name.trim()) return
    onSave({ name: name.trim(), role: role.trim(), company: company.trim(), how: how.trim(), warmth })
  }

  return (
    <div
      style={{
        marginTop: 12,
        padding: '16px 18px',
        background: 'rgba(0,212,232,0.03)',
        border: '1px solid rgba(0,212,232,0.18)',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        animation: 'srpRowFade 240ms ease both',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Name</label>
          <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
        </div>
        <div>
          <label style={labelStyle}>Role / Title</label>
          <input style={inputStyle} value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Partnerships Editor" />
        </div>
        <div>
          <label style={labelStyle}>Company</label>
          <input style={inputStyle} value={company} onChange={e => setCompany(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>How you know them <span style={{ opacity: 0.6 }}>(optional)</span></label>
          <input style={inputStyle} value={how} onChange={e => setHow(e.target.value)} placeholder="e.g. Met at a conference" />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Warmth</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {WARMTH.map(w => {
            const active = warmth === w
            return (
              <button
                key={w}
                onClick={() => setWarmth(w)}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: 5,
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                  background: active ? 'rgba(0,212,232,0.1)' : 'transparent',
                  border: `1px solid ${active ? 'rgba(0,212,232,0.4)' : 'var(--border)'}`,
                  color: active ? 'var(--cyan)' : 'var(--text-muted)',
                  transition: 'all 0.15s',
                }}
              >
                {w}
              </button>
            )
          })}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          onClick={save}
          disabled={!name.trim()}
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#0b1f0b',
            background: name.trim() ? '#94c864' : 'rgba(148,200,100,0.3)',
            border: 'none',
            borderRadius: 5,
            padding: '9px 18px',
            cursor: name.trim() ? 'pointer' : 'default',
          }}
        >
          Save Contact
        </button>
        <button
          onClick={onCancel}
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            letterSpacing: '0.06em',
            color: 'var(--text-muted)',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 5,
            padding: '9px 14px',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function ContactCard({ gap, contact, onDraft, onEdit, onRemove }) {
  const Field = ({ k, v }) => (
    <div style={{ display: 'flex', gap: 10, padding: '3px 0' }}>
      <span style={{ minWidth: 130, fontFamily: FONT_MONO, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {k}
      </span>
      <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: '#c8d0dc' }}>{v || '—'}</span>
    </div>
  )
  return (
    <div
      style={{
        marginTop: 12,
        padding: '16px 18px',
        background: 'rgba(148,200,100,0.04)',
        border: '1px solid rgba(148,200,100,0.2)',
        borderRadius: 8,
        animation: 'srpRowFade 240ms ease both',
      }}
    >
      <Field k="Name" v={contact.name} />
      <Field k="Role" v={contact.role} />
      <Field k="Company" v={contact.company} />
      <Field k="Warmth" v={contact.warmth} />
      <Field k="How you know them" v={contact.how} />
      <div
        style={{
          display: 'flex',
          gap: 10,
          marginTop: 14,
          paddingTop: 12,
          borderTop: '1px solid rgba(255,255,255,0.05)',
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={onDraft}
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#94c864',
            background: 'transparent',
            border: '1px solid rgba(148,200,100,0.4)',
            borderRadius: 5,
            padding: '8px 14px',
            cursor: 'pointer',
          }}
        >
          ⬡ Draft Outreach
        </button>
        <button
          onClick={onEdit}
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--cyan)',
            background: 'transparent',
            border: '1px solid rgba(0,212,232,0.35)',
            borderRadius: 5,
            padding: '8px 14px',
            cursor: 'pointer',
          }}
        >
          Edit
        </button>
        <button
          onClick={onRemove}
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 5,
            padding: '8px 14px',
            cursor: 'pointer',
          }}
        >
          Remove
        </button>
      </div>
    </div>
  )
}

function GapContactRow({ gap, contact, expanded, editing, onToggle, onAdd, onSave, onCancel, onDraft, onEdit, onRemove }) {
  const path = urlPath(gap.url)
  const geo = geoLabel(gap.country)
  const badge = badgeFor(contact)

  return (
    <Card style={{ padding: '14px 18px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <span style={{ fontFamily: FONT_BODY, fontSize: 14, fontWeight: 500, color: 'var(--white)' }}>
            {gap.domain}
            <span style={{ color: 'var(--text-muted)' }}>{path}</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: 'var(--cyan)' }}>{geo}</span>
            <Badge color="var(--t1)" bg="var(--t1-dim)" border="rgba(148,200,100,0.4)">T1</Badge>
          </div>
        </div>

        {badge ? (
          <button
            onClick={onToggle}
            title={badge.label === 'DIRECT' ? 'You have a contact at this domain' : 'You have a contact who may know someone here'}
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: badge.color,
              background: badge.bg,
              border: `1px solid ${badge.border}`,
              borderRadius: 5,
              padding: '7px 14px',
              cursor: 'pointer',
            }}
          >
            {badge.label} {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <button
            onClick={onAdd}
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--cyan)',
              background: 'transparent',
              border: '1px solid rgba(0,212,232,0.4)',
              borderRadius: 5,
              padding: '7px 14px',
              cursor: 'pointer',
            }}
          >
            + Add Contact
          </button>
        )}
      </div>

      {editing && (
        <ContactForm gap={gap} initial={contact} onSave={onSave} onCancel={onCancel} />
      )}
      {!editing && expanded && contact && (
        <ContactCard
          gap={gap}
          contact={contact}
          onDraft={onDraft}
          onEdit={onEdit}
          onRemove={onRemove}
        />
      )}
    </Card>
  )
}

export default function NetworkPanel({ onAskIntel }) {
  const { org } = useOrg()
  const [contacts, setContacts] = useState(readContacts)
  // gap.url → 'form' (add/edit form open) | 'card' (contact card open) | null
  const [openState, setOpenState] = useState({})

  // Gmail sync (UI placeholder — real token validation is V2).
  const [gmailConnected, setGmailConnected] = useState(() => {
    try { return localStorage.getItem(GMAIL_CONNECTED_KEY) === 'true' } catch { return false }
  })
  const [gmailError, setGmailError] = useState(false)

  const connectGmail = () => {
    const CLIENT_ID = import.meta.env.VITE_GMAIL_CLIENT_ID || ''
    if (!CLIENT_ID) {
      setGmailError(true)
      return
    }
    const REDIRECT_URI = encodeURIComponent(window.location.origin + '/auth/gmail/callback')
    const SCOPE = encodeURIComponent('https://www.googleapis.com/auth/gmail.readonly')
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=${SCOPE}&access_type=offline&prompt=consent`
    window.location.href = url
  }

  const disconnectGmail = () => {
    try { localStorage.setItem(GMAIL_CONNECTED_KEY, 'false') } catch { /* ignore */ }
    setGmailConnected(false)
  }

  const t1Gaps = GAPS_T1

  // Seed one DIRECT contact for the Bybit EU demo org (finder.com), once.
  useEffect(() => {
    if (org?.slug !== DEMO_ORG_SLUG) return
    const finder = t1Gaps.find(g => g.domain === 'finder.com')
    if (!finder) return
    setContacts(prev => {
      if (prev[finder.url]) return prev
      const next = {
        ...prev,
        [finder.url]: {
          name: 'James Whitfield',
          role: 'Partnerships Editor',
          company: 'Finder.com',
          how: 'Met at Affiliate Summit London 2025',
          warmth: 'DIRECT',
        },
      }
      writeContacts(next)
      return next
    })
  }, [org, t1Gaps])

  const persist = useCallback((next) => {
    setContacts(next)
    writeContacts(next)
  }, [])

  const withContact = useMemo(
    () => t1Gaps.filter(g => contacts[g.url]).length,
    [t1Gaps, contacts],
  )
  const total = t1Gaps.length
  const scorePct = total ? Math.round((withContact / total) * 100) : 0

  const draftOutreach = (gap, contact) => {
    const comp = (gap.competitors || [])[0] || 'a competitor'
    const geo = geoLabel(gap.country)
    const prompt = `Draft outreach to ${contact.name}, ${contact.role || 'contact'} at ${
      contact.company || gap.domain
    }. Context: ${gap.domain}${urlPath(gap.url)} is a T1 gap for Bybit in ${geo}. ${comp} is currently listed. Goal: get Bybit listed on this page. Tone: warm, brief, value-first${
      contact.how ? `. You know them: ${contact.how}` : ''
    }.`
    onAskIntel?.(
      `You are helping draft outreach to a known contact for a Bybit EU T1 gap. Contact: ${contact.name} (${contact.role}) at ${contact.company}. Gap: ${gap.domain}${urlPath(gap.url)} — ${geo}, ${comp} currently listed.`,
      { insight: 'Outreach context loaded — tap below to draft the email.', chips: [prompt] },
    )
  }

  const intelContext = () =>
    `You are reviewing network intelligence. ${withContact} of ${total} T1 gaps have a known contact (${scorePct}%). Gmail sync not yet wired.`

  return (
    <>
      <PanelHeader
        title="Network Intelligence"
        accent="#00d4e8"
        sub="Contact intelligence mapped to your gap list. Add contacts as you work each gap. Gmail sync coming."
        right={onAskIntel && (
          <AskIntelButton
            onClick={() =>
              onAskIntel(
                intelContext(),
                intelKit.network({
                  nodes: withContact,
                  strong: 'your DIRECT T1 contacts',
                  cold: 'uncontacted T1 gaps',
                  gapRegion: 'most of the T1 list',
                }),
              )
            }
          />
        )}
      />

      {/* NETWORK SCORE */}
      <Card style={{ padding: '18px 22px', marginBottom: 18 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <span style={{ fontFamily: FONT_BODY, fontSize: 14, color: '#c8d0dc' }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 22, fontWeight: 600, color: '#94c864' }}>
              {withContact}
            </span>{' '}
            of {total} T1 gaps have a known contact
          </span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: 'var(--text-muted)' }}>
            {scorePct}%
          </span>
        </div>
        <div style={{ width: '100%', height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
          <div
            style={{
              width: `${scorePct}%`,
              height: '100%',
              background: '#94c864',
              borderRadius: 99,
              transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)',
            }}
          />
        </div>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {t1Gaps.map(gap => {
          const contact = contacts[gap.url] || null
          const state = openState[gap.url] || null
          return (
            <GapContactRow
              key={gap.url}
              gap={gap}
              contact={contact}
              expanded={state === 'card'}
              editing={state === 'form'}
              onToggle={() =>
                setOpenState(s => ({ ...s, [gap.url]: s[gap.url] === 'card' ? null : 'card' }))
              }
              onAdd={() => setOpenState(s => ({ ...s, [gap.url]: 'form' }))}
              onEdit={() => setOpenState(s => ({ ...s, [gap.url]: 'form' }))}
              onCancel={() => setOpenState(s => ({ ...s, [gap.url]: null }))}
              onSave={c => {
                persist({ ...contacts, [gap.url]: c })
                setOpenState(s => ({ ...s, [gap.url]: null }))
              }}
              onRemove={() => {
                const next = { ...contacts }
                delete next[gap.url]
                persist(next)
                setOpenState(s => ({ ...s, [gap.url]: null }))
              }}
              onDraft={() => draftOutreach(gap, contact)}
            />
          )
        })}
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              color: 'var(--text-muted)',
              lineHeight: 1.6,
            }}
          >
            Gmail sync will automatically detect contacts across your gap list. Coming soon.
          </span>

          {gmailConnected ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#94c864',
                }}
              >
                Gmail Connected ✓
              </span>
              <button
                onClick={disconnectGmail}
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Disconnect
              </button>
            </span>
          ) : (
            <button
              onClick={connectGmail}
              style={{
                fontFamily: FONT_MONO,
                fontSize: 11,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--cyan)',
                background: 'transparent',
                border: '1px solid rgba(0,212,232,0.4)',
                borderRadius: 5,
                padding: '7px 14px',
                cursor: 'pointer',
              }}
            >
              Connect Gmail
            </button>
          )}
        </div>

        {gmailError && !gmailConnected && (
          <div
            style={{
              marginTop: 8,
              fontFamily: FONT_MONO,
              fontSize: 11,
              color: 'var(--amber)',
              lineHeight: 1.6,
            }}
          >
            Gmail sync not configured — contact admin
          </div>
        )}
      </div>
    </>
  )
}
