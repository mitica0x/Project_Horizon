import { useState, useEffect } from 'react'
import { TABLE_DATA as SITE_TABLE_DATA, PAGES_TRACKED, ALL_SITES } from '../data/staticData'
import { AskIntelButton, SiteLink } from './horizonUI'

const CANDIDATES = [
  { domain: 'finder.com',           tier: 'Tier 1', reason: 'Global comparison giant, EU traffic' },
  { domain: 'moneysupermarket.com', tier: 'Tier 1', reason: 'UK #1 comparison, crypto section growing' },
  { domain: 'money.co.uk',          tier: 'Tier 1', reason: 'UK comparison, active crypto exchange reviews' },
  { domain: 'brokerchooser.com',    tier: 'Tier 1', reason: 'EU broker comparison, high organic traffic' },
  { domain: 'cryptowisser.com',     tier: 'Tier 2', reason: 'Crypto exchange comparison, EU-focused' },
  { domain: 'cryptoradar.co',       tier: 'Tier 2', reason: 'Exchange comparison tool, EU visitors' },
  { domain: 'coinjournal.net',      tier: 'Tier 2', reason: 'Crypto news + exchange reviews' },
  { domain: 'fxempire.com',         tier: 'Tier 2', reason: 'Broker + crypto reviews, large EU readership' },
  { domain: 'tradingplatforms.com', tier: 'Tier 2', reason: 'Trading platform comparisons, EU traffic' },
  { domain: 'investingoal.com',     tier: 'Tier 2', reason: 'EU-focused broker and crypto comparisons' },
  { domain: 'financemagnates.com',  tier: 'Tier 2', reason: 'Fintech media, broker reviews' },
  { domain: 'monito.com',           tier: 'Tier 2', reason: 'EU money transfer comparison, Bybit Card angle' },
  { domain: 'allthecryptos.com',    tier: 'Tier 3', reason: 'Exchange aggregator, growing EU presence' },
  { domain: 'coincarp.com',         tier: 'Tier 3', reason: 'Exchange data + comparisons' },
  { domain: 'learn2.trade',         tier: 'Tier 3', reason: 'Trading education + broker reviews' },
  { domain: 'cryptonews.com',       tier: 'Tier 3', reason: 'News + exchange reviews, EU audience' },
  { domain: 'bestbrokers.com',      tier: 'Tier 3', reason: 'Broker comparison, EU regulated focus' },
  { domain: 'cryptorobin.com',      tier: 'Tier 3', reason: 'Exchange reviews, EU traffic' },
  { domain: 'exchangerates.org.uk', tier: 'Tier 3', reason: 'UK exchange rates + crypto section' },
  { domain: 'brokerstorm.com',      tier: 'Tier 3', reason: 'EU broker reviews, niche but relevant' },
]

// Filter out candidates already tracked (case-insensitive domain match)
const TRACKED_DOMAINS = new Set(SITE_TABLE_DATA.map(s => (s.domain || '').toLowerCase()))
const FILTERED_CANDIDATES = CANDIDATES.filter(c => !TRACKED_DOMAINS.has(c.domain.toLowerCase()))

const TIER_STYLES = {
  'Tier 1': { color: '#94c864', bg: 'rgba(148,200,100,0.15)',  border: 'rgba(148,200,100,0.4)',  label: 'T1' },
  'Tier 2': { color: '#D4A853', bg: 'rgba(212,168,83,0.15)', border: 'rgba(212,168,83,0.4)', label: 'T2' },
  'Tier 3': { color: '#7B5EA7', bg: 'rgba(123,94,167,0.15)', border: 'rgba(123,94,167,0.4)', label: 'T3' },
}

function TierBadge({ tier }) {
  const s = TIER_STYLES[tier] || TIER_STYLES['Tier 2']
  return (
    <span style={{
      fontFamily:    "'Geist', sans-serif",
      fontWeight:    700,
      fontSize:      10,
      letterSpacing: '0.06em',
      padding:       '2px 7px',
      borderRadius:  3,
      background:    s.bg,
      color:         s.color,
      border:        `1px solid ${s.border}`,
      whiteSpace:    'nowrap',
      flexShrink:    0,
    }}>{s.label}</span>
  )
}

function StatusDot({ status }) {
  const present = status === 'present'
  const color = present ? '#94c864' : '#D4A853'
  return (
    <span
      title={present ? 'Bybit present' : 'Gap'}
      style={{
        display:      'inline-block',
        width:        8,
        height:       8,
        borderRadius: '50%',
        background:   color,
        boxShadow:    `0 0 6px ${color}`,
        flexShrink:   0,
      }}
    />
  )
}

function TrackedTab() {
  return (
    <div>
      {ALL_SITES.map((s, i) => (
        <div
          key={`${s.url}-${i}`}
          style={{
            display:      'flex',
            alignItems:   'center',
            gap:          10,
            padding:      '10px 0',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          <StatusDot status={s.status} />
          <span style={{
            flex:         1,
            fontFamily:   "'Geist Mono', monospace",
            fontSize:     13,
            color:        '#00d4e8',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            <SiteLink domain={s.domain || s.url}>{s.domain || s.url}</SiteLink>
          </span>
          <TierBadge tier={s.tier} />
        </div>
      ))}
    </div>
  )
}

function CandidatesTab() {
  return (
    <div>
      {FILTERED_CANDIDATES.map((c, i) => (
        <div
          key={`${c.domain}-${i}`}
          style={{
            display:      'flex',
            alignItems:   'flex-start',
            gap:          12,
            padding:      '12px 0',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display:      'flex',
              alignItems:   'center',
              gap:          8,
              marginBottom: 4,
            }}>
              <span style={{
                fontFamily:   "'Geist Mono', monospace",
                fontSize:     13,
                color:        '#ffffff',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
              }}><SiteLink domain={c.domain}>{c.domain}</SiteLink></span>
              <TierBadge tier={c.tier} />
            </div>
            <div style={{
              fontFamily: "'Geist', sans-serif",
              fontSize:   11,
              color:      '#8892a4',
              lineHeight: 1.4,
            }}>{c.reason}</div>
          </div>
          <span
            style={{
              fontFamily:    "'Geist Mono', monospace",
              fontSize:      11,
              letterSpacing: '0.06em',
              color:         '#00d4e8',
              padding:       '6px 10px',
              flexShrink:    0,
              whiteSpace:    'nowrap',
            }}
          >MONITORED SOON</span>
        </div>
      ))}
    </div>
  )
}

function AddNewTab() {
  const [url,   setUrl]   = useState('')
  const [tier,  setTier]  = useState('Tier 2')
  const [notes, setNotes] = useState('')
  const [msg,   setMsg]   = useState('')
  const [focus, setFocus] = useState(null)

  const submit = () => {
    const trimmed = url.trim()
    if (!trimmed) {
      setMsg('URL is required')
      return
    }
    console.log({ domain: trimmed, tier, notes: notes.trim() })
    setMsg('Added to queue — Airtable sync in v2')
    setUrl('')
    setNotes('')
    setTier('Tier 2')
  }

  const labelStyle = {
    display:        'block',
    fontFamily:     "'Geist', sans-serif",
    fontWeight:     600,
    fontSize:       11,
    letterSpacing:  '0.08em',
    textTransform:  'uppercase',
    color:          '#8892a4',
    marginBottom:   6,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* URL */}
      <div>
        <label style={labelStyle}>URL</label>
        <input
          type="text"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onFocus={() => setFocus('url')}
          onBlur={() => setFocus(null)}
          placeholder="example.com/path"
          style={{
            width:        '100%',
            boxSizing:    'border-box',
            background:   'rgba(255,255,255,0.04)',
            border:       `1px solid ${focus === 'url' ? 'rgba(0,212,232,0.4)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 6,
            padding:      '10px 12px',
            fontFamily:   "'Geist Mono', monospace",
            fontSize:     13,
            color:        '#00d4e8',
            outline:      'none',
            transition:   'border-color 0.15s',
          }}
        />
      </div>

      {/* Tier pills */}
      <div>
        <label style={labelStyle}>Tier</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {['Tier 1', 'Tier 2', 'Tier 3'].map(t => {
            const s = TIER_STYLES[t]
            const active = tier === t
            return (
              <button
                key={t}
                onClick={() => setTier(t)}
                style={{
                  flex:           1,
                  padding:        '8px 12px',
                  borderRadius:   4,
                  fontFamily:     "'Geist', sans-serif",
                  fontWeight:     700,
                  fontSize:       11,
                  letterSpacing:  '0.06em',
                  cursor:         'pointer',
                  background:     active ? s.bg : 'transparent',
                  border:         `1px solid ${active ? s.color : 'rgba(255,255,255,0.08)'}`,
                  color:          active ? s.color : '#8892a4',
                  transition:     'background 0.15s, border-color 0.15s, color 0.15s',
                }}
              >{s.label}</button>
            )
          })}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label style={labelStyle}>
          Notes <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, opacity: 0.6 }}>(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onFocus={() => setFocus('notes')}
          onBlur={() => setFocus(null)}
          rows={2}
          placeholder="Why this site, expected angle..."
          style={{
            width:        '100%',
            boxSizing:    'border-box',
            background:   'rgba(255,255,255,0.04)',
            border:       `1px solid ${focus === 'notes' ? 'rgba(0,212,232,0.4)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 6,
            padding:      '10px 12px',
            fontFamily:   "'Geist', sans-serif",
            fontSize:     13,
            color:        '#ffffff',
            resize:       'vertical',
            outline:      'none',
            transition:   'border-color 0.15s',
          }}
        />
      </div>

      {/* Submit */}
      <button
        onClick={submit}
        style={{
          padding:        '12px 16px',
          borderRadius:   6,
          background:     'transparent',
          color:          '#94c864',
          fontFamily:     "'Geist', sans-serif",
          fontWeight:     700,
          fontSize:       13,
          letterSpacing:  '0.06em',
          textTransform:  'uppercase',
          border:         '1.5px solid #94c864',
          cursor:         'pointer',
          transition:     'opacity 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '0.9' }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '1'   }}
      >＋ Add to Scope</button>

      {msg && (
        <div style={{
          padding:      '10px 12px',
          borderRadius: 4,
          background:   msg.includes('required') ? 'rgba(255,77,109,0.08)' : 'rgba(0,229,160,0.08)',
          border:       `1px solid ${msg.includes('required') ? 'rgba(255,77,109,0.3)' : 'rgba(0,229,160,0.3)'}`,
          fontFamily:   "'Geist Mono', monospace",
          fontSize:     11,
          color:        msg.includes('required') ? '#ff4d6d' : '#94c864',
        }}>
          {msg}
        </div>
      )}
    </div>
  )
}

export default function ScopePanel({ open, onClose, onAskIntel }) {
  const [mounted, setMounted] = useState(false)
  const [tab,     setTab]     = useState('tracked')

  const traceContext = () =>
    `You are reviewing TRACE — tracked sources and feed suggestions. Currently tracking ${PAGES_TRACKED} sources across ${ALL_SITES.length} unique domains; ${FILTERED_CANDIDATES.length} candidate sources awaiting review.`

  useEffect(() => {
    if (!open) {
      setMounted(false)
      return
    }
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [open])

  if (!open) return null

  const tabs = [
    { id: 'tracked',    label: `TRACKED (${PAGES_TRACKED})` },
    { id: 'candidates', label: `CANDIDATES (${FILTERED_CANDIDATES.length})` },
    { id: 'addnew',     label: 'ADD NEW' },
  ]

  return (
    <>
      {/* backdrop */}
      <div
        onClick={onClose}
        style={{
          position:   'fixed',
          inset:      0,
          background: 'rgba(0,0,0,0.4)',
          zIndex:     99,
        }}
      />

      {/* panel */}
      <aside
        style={{
          position:       'fixed',
          top:            0,
          right:          0,
          width:          480,
          height:         '100vh',
          background:     '#131929',
          borderLeft:     '1px solid rgba(148,200,100,0.15)',
          zIndex:         100,
          display:        'flex',
          flexDirection:  'column',
          transform:      mounted ? 'translateX(0)' : 'translateX(100%)',
          transition:     'transform 300ms ease',
        }}
      >
        {/* header */}
        <div style={{
          flexShrink:     0,
          padding:        '18px 20px',
          borderBottom:   '1px solid rgba(255,255,255,0.06)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
        }}>
          <div style={{
            fontFamily:     "'Geist', sans-serif",
            fontWeight:     700,
            fontSize:       14,
            letterSpacing:  '0.1em',
            textTransform:  'uppercase',
            color:          '#ffffff',
          }}>◷ TRACE</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {onAskIntel && <AskIntelButton onClick={() => onAskIntel(traceContext())} />}
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border:     'none',
              color:      '#8892a4',
              fontSize:   20,
              cursor:     'pointer',
              lineHeight: 1,
              padding:    '0 2px',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ffffff' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#8892a4' }}
          >×</button>
          </div>
        </div>

        {/* tabs */}
        <div style={{
          flexShrink:    0,
          display:       'flex',
          borderBottom:  '1px solid rgba(255,255,255,0.06)',
        }}>
          {tabs.map(t => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  flex:           1,
                  padding:        '12px 8px',
                  background:     'none',
                  border:         'none',
                  borderBottom:   `2px solid ${active ? '#94c864' : 'transparent'}`,
                  color:          active ? '#ffffff' : '#8892a4',
                  fontFamily:     "'Geist', sans-serif",
                  fontWeight:     700,
                  fontSize:       11,
                  letterSpacing:  '0.08em',
                  cursor:         'pointer',
                  transition:     'color 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#c8d0dc' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#8892a4' }}
              >{t.label}</button>
            )
          })}
        </div>

        {/* tab content */}
        <div style={{
          flex:           1,
          overflowY:      'auto',
          padding:        '16px 20px',
          scrollbarWidth: 'thin',
        }}>
          {tab === 'tracked'    && <TrackedTab    />}
          {tab === 'candidates' && <CandidatesTab />}
          {tab === 'addnew'     && <AddNewTab     />}
        </div>
      </aside>
    </>
  )
}
