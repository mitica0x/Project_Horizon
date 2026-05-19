import { useState, useEffect, useCallback } from 'react'
import { RADAR_EVENTS } from '../lib/radar/events'
import { filterEvents, groupByMonth, fmtMonth, computeLivingScore, getAlertInfo } from '../lib/radar/scoring'
import { assessCompetitors } from '../lib/radar/competitors'
import { fetchDetectedEvents, confirmDetectedEvent, dismissDetectedEvent, fetchDetectionSettings, updateDetectionSettings, runDetectNow, detectedSyntheticId } from '../api/detection'

const TYPE_TO_CAT = { sports:'sports', web3:'web3', cultural:'cultural', business:'business', regulatory:'business', other:'business' }

const CAT_COLORS = {
  sports:   { bg: 'rgba(0,212,232,0.1)',   color: 'var(--cyan)' },
  web3:     { bg: 'rgba(212,168,83,0.15)', color: 'var(--amber)' },
  business: { bg: 'rgba(123,94,167,0.15)', color: 'var(--purple)' },
  cultural: { bg: 'rgba(148,200,100,0.1)', color: 'var(--green)' },
}

const STATUS_COLORS = {
  'missed':       { bg: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)' },
  'last-chance':  { bg: 'rgba(255,77,109,0.12)',  color: 'var(--red)' },
  'act-now':      { bg: 'rgba(212,168,83,0.15)',  color: 'var(--amber)' },
  'urgent':       { bg: 'rgba(212,168,83,0.15)',  color: 'var(--amber)' },
  'brief-window': { bg: 'rgba(0,212,232,0.1)',    color: 'var(--cyan)' },
  'on-radar':     { bg: 'rgba(148,200,100,0.08)', color: 'var(--green)' },
}

const VERDICT_BADGE = {
  move:     { label: 'MOVE',     color: 'var(--amber)', bg: 'rgba(212,168,83,0.15)' },
  consider: { label: 'CONSIDER', color: 'var(--cyan)',  bg: 'rgba(0,212,232,0.1)' },
  skip:     { label: 'SKIP',     color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)' },
}

const BUDGETS = [{ key:'low', label:'LOW <€20k' }, { key:'mid', label:'MID €20–100k' }, { key:'high', label:'HIGH >€100k' }]
const CAPABILITIES = [{ key:'content', label:'Content' }, { key:'paid', label:'Paid' }, { key:'partner', label:'Partner' }]

const mono = { fontFamily: 'var(--font-mono)' }
const chipBase = { ...mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '5px 11px', borderRadius: 4, cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s, color 0.15s', lineHeight: 1, border: 'none' }
const chipActive = { ...chipBase, border: '1px solid var(--amber)', background: 'rgba(212,168,83,0.15)', color: 'var(--amber)' }
const chipInactive = { ...chipBase, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-muted)' }

function fmtDate(d) {
  const [,m,day] = d.split('-')
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m-1] + ' ' + day
}

function daysUntil(d) {
  return Math.round((new Date(d) - new Date()) / 86400000)
}

function EventCard({ event, verdict, constraints, dismissed, detected, onDismiss, onActivate }) {
  const [hover, setHover] = useState(false)
  const living = computeLivingScore(event, constraints, assessCompetitors(event, constraints))
  const alert = getAlertInfo(event.date)
  const cat = CAT_COLORS[event.cat] || CAT_COLORS.business
  const status = STATUS_COLORS[alert.status]
  const daysOut = daysUntil(event.date)
  const daysLabel = daysOut < 0 ? 'PAST' : daysOut === 0 ? 'TODAY' : `T-${daysOut}D`
  const field = living.fieldOpenness >= 1 ? { label:'OPEN', color:'var(--green)' } : living.fieldOpenness <= -1 ? { label:'CONTESTED', color:'var(--amber)' } : { label:'CROWDED', color:'var(--text-muted)' }
  const vb = verdict ? VERDICT_BADGE[verdict] : null

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px',
        background: hover ? 'rgba(255,255,255,0.03)' : 'var(--bg-card)',
        border: `1px solid ${detected ? 'var(--amber)' : 'rgba(255,255,255,0.07)'}`,
        borderLeft: detected ? '3px solid var(--amber)' : '1px solid rgba(255,255,255,0.07)',
        borderRadius: 6, opacity: dismissed ? 0.35 : 1,
        transition: 'background 0.15s',
      }}
    >
      <div style={{ display:'flex', alignItems:'flex-start', gap:16 }}>
        <div style={{ flexShrink:0, minWidth:72 }}>
          <div style={{ ...mono, fontSize:11, color:'var(--text-muted)' }}>{fmtDate(event.date)}</div>
          <div style={{ ...mono, fontSize:12, fontWeight:700, color:'var(--amber)', marginTop:3 }}>{daysLabel}</div>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <span style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)' }}>{event.name}</span>
            <span style={{ ...mono, fontSize:9, padding:'2px 6px', borderRadius:3, textTransform:'uppercase', letterSpacing:'0.08em', background:cat.bg, color:cat.color }}>{event.cat}</span>
            {detected && <span style={{ ...mono, fontSize:9, padding:'2px 6px', borderRadius:3, textTransform:'uppercase', background:'rgba(212,168,83,0.15)', color:'var(--amber)' }}>{detected.confirmed?'CONFIRMED':'DETECTED'} · {detected.confidence}%</span>}
            {dismissed && <span style={{ ...mono, fontSize:9, textTransform:'uppercase', color:'var(--red)' }}>DISMISSED</span>}
          </div>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{event.sub}</div>
        </div>
        <div style={{ flexShrink:0, display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ textAlign:'right' }}>
            <div style={{ ...mono, fontSize:18, fontWeight:700, color:'var(--text-primary)' }}>{living.adjustedTotal}<span style={{ fontSize:10, color:'var(--text-muted)' }}>/10</span></div>
            <div style={{ ...mono, fontSize:9, color:'var(--text-muted)', textTransform:'uppercase' }}>relevance</div>
          </div>
          {vb && <span style={{ ...mono, fontSize:10, fontWeight:700, letterSpacing:'0.1em', padding:'4px 9px', borderRadius:4, background:vb.bg, color:vb.color, border:`1px solid ${vb.color}` }}>{vb.label}</span>}
          <span style={{ ...mono, fontSize:9, letterSpacing:'0.08em', padding:'4px 8px', borderRadius:4, background:'rgba(255,255,255,0.05)', color:field.color }}>{field.label}</span>
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:10 }}>
        <span style={{ ...mono, fontSize:10, letterSpacing:'0.06em', padding:'3px 8px', borderRadius:3, background:status.bg, color:status.color }}>{alert.label}</span>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={onActivate} style={{ ...mono, fontSize:10, letterSpacing:'0.08em', textTransform:'uppercase', padding:'6px 12px', borderRadius:5, border:'1px solid var(--amber)', background:'var(--amber)', color:'#0a0e1a', fontWeight:700, cursor:'pointer' }}>Activate</button>
          <button onClick={onDismiss} style={{ ...mono, fontSize:10, textTransform:'uppercase', padding:'6px 12px', borderRadius:5, border:'1px solid rgba(255,255,255,0.12)', background:'transparent', color:'var(--text-muted)', cursor:'pointer' }}>Dismiss</button>
        </div>
      </div>
    </div>
  )
}

function VerdictBar({ verdict, total, moveCount }) {
  const META = {
    move:     { word:'MOVE',     color:'var(--amber)', dim:'rgba(212,168,83,0.12)' },
    consider: { word:'CONSIDER', color:'var(--cyan)',  dim:'rgba(0,212,232,0.08)' },
    skip:     { word:'SKIP',     color:'var(--text-muted)', dim:'rgba(255,255,255,0.04)' },
  }
  const m = verdict ? META[verdict] : null
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, padding:'14px 18px', marginBottom:16, background:m?m.dim:'rgba(255,255,255,0.03)', border:`1px solid ${m?m.color:'rgba(255,255,255,0.07)'}`, borderRadius:6 }}>
      <div style={{ display:'flex', alignItems:'baseline', gap:12 }}>
        <span style={{ ...mono, fontSize:20, fontWeight:700, letterSpacing:'0.14em', color:m?m.color:'var(--text-muted)' }}>{m?m.word:'MONITORING'}</span>
        <span style={{ ...mono, fontSize:10, color:'var(--text-muted)', textTransform:'uppercase' }}>{verdict?'highest-priority signal':'no verdict yet'}</span>
      </div>
      <span style={{ ...mono, fontSize:11, color:'var(--text-muted)' }}>{total} events · <span style={{ color:'var(--amber)' }}>{moveCount} MOVE</span></span>
    </div>
  )
}

function ConstraintBar({ constraints, onChange }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:20, flexWrap:'wrap', padding:'12px 0', marginBottom:12, borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ ...mono, fontSize:10, color:'var(--amber)', textTransform:'uppercase', letterSpacing:'0.14em' }}>Constraints</span>
      <div style={{ display:'flex', gap:6 }}>
        {BUDGETS.map(b => <button key={b.key} onClick={() => onChange({...constraints, budget:b.key})} style={constraints.budget===b.key?chipActive:chipInactive}>{b.label}</button>)}
      </div>
      <div style={{ display:'flex', gap:6 }}>
        {CAPABILITIES.map(c => {
          const active = constraints.capabilities.includes(c.key)
          return <button key={c.key} onClick={() => { const caps = active ? constraints.capabilities.filter(x=>x!==c.key) : [...constraints.capabilities,c.key]; onChange({...constraints,capabilities:caps}) }} style={active?chipActive:chipInactive}>{c.label}</button>
        })}
      </div>
    </div>
  )
}

export default function EventsSection({ orgId }) {
  const [constraints, setConstraints] = useState({ budget:'mid', capabilities:['content','paid','partner'] })
  const [dismissed, setDismissed] = useState(new Set())
  const [detected, setDetected] = useState([])
  const [settings, setSettings] = useState(null)
  const [catFilter, setCatFilter] = useState('all')
  const [highOnly, setHighOnly] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [detectCount, setDetectCount] = useState(null)

  useEffect(() => {
    if (!orgId) return
    fetchDetectedEvents(orgId).then(setDetected).catch(()=>{})
    fetchDetectionSettings(orgId).then(setSettings).catch(()=>{})
  }, [orgId])

  const detectedAsRadar = detected
    .filter(d => !d.dismissed)
    .map(d => ({
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
  const filtered = filterEvents(allEvents, catFilter, highOnly).filter(e => !dismissed.has(e.id))
  const grouped = groupByMonth(filtered)

  const computeVerdict = (event) => {
    const living = computeLivingScore(event, constraints, assessCompetitors(event, constraints))
    if (living.adjustedTotal >= 8) return 'move'
    if (living.adjustedTotal >= 6) return 'consider'
    return 'skip'
  }

  const topVerdict = filtered.length === 0 ? null : (() => {
    const scores = filtered.map(e => computeLivingScore(e, constraints, assessCompetitors(e, constraints)).adjustedTotal)
    const max = Math.max(...scores)
    if (max >= 8) return 'move'
    if (max >= 6) return 'consider'
    return 'skip'
  })()

  const moveCount = filtered.filter(e => computeVerdict(e) === 'move').length

  const handleDismiss = useCallback((event) => {
    setDismissed(prev => new Set([...prev, event.id]))
    if (event._detectedId) dismissDetectedEvent(event._detectedId).catch(()=>{})
  }, [])

  const handleActivate = useCallback((event) => {
    if (event._detectedId) confirmDetectedEvent(event._detectedId).catch(()=>{})
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
    } catch {}
    setDetecting(false)
  }, [orgId, detecting])

  const CATS = ['all','sports','web3','business','cultural']

  return (
    <div style={{ padding:'28px 32px', maxWidth:900, margin:'0 auto' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.01em' }}>EVENTS</div>
          <div style={{ ...mono, fontSize:11, color:'var(--text-muted)', marginTop:4 }}>{filtered.length} events · 180-day window</div>
        </div>
        <button
          onClick={handleDetectNow}
          disabled={detecting}
          style={{ ...mono, fontSize:11, textTransform:'uppercase', letterSpacing:'0.08em', padding:'8px 16px', borderRadius:6, border:'1px solid var(--cyan)', background:'transparent', color:'var(--cyan)', cursor:detecting?'default':'pointer', opacity:detecting?0.5:1 }}
        >
          {detecting ? 'Detecting…' : detectCount !== null ? `+${detectCount} detected` : 'Detect Now'}
        </button>
      </div>

      <VerdictBar verdict={topVerdict} total={filtered.length} moveCount={moveCount} />
      <ConstraintBar constraints={constraints} onChange={setConstraints} />

      <div style={{ display:'flex', gap:6, marginBottom:20, flexWrap:'wrap' }}>
        {CATS.map(c => <button key={c} onClick={() => setCatFilter(c)} style={catFilter===c?chipActive:chipInactive}>{c}</button>)}
        <button onClick={() => setHighOnly(h=>!h)} style={highOnly?chipActive:chipInactive}>High priority only</button>
      </div>

      {filtered.length === 0 ? (
        <div style={{ ...mono, fontSize:12, color:'var(--text-muted)', textAlign:'center', padding:'60px 0' }}>No events match current filters.</div>
      ) : (
        [...grouped.entries()].map(([month, events]) => (
          <div key={month} style={{ marginBottom:28 }}>
            <div style={{ ...mono, fontSize:11, color:'var(--cyan)', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:10 }}>{month}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {events.map(event => (
                <EventCard
                  key={event.id}
                  event={event}
                  verdict={computeVerdict(event)}
                  constraints={constraints}
                  dismissed={dismissed.has(event.id)}
                  detected={event._detectedId ? { confidence:event._confidence, sourceName:event._sourceName, confirmed:event._confirmed } : null}
                  onDismiss={() => handleDismiss(event)}
                  onActivate={() => handleActivate(event)}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
