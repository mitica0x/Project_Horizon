import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as Tooltip from '@radix-ui/react-tooltip'
import * as Dialog from '@radix-ui/react-dialog'
import { ChevronDown, Radar, Hexagon } from 'lucide-react'
import { toast } from 'sonner'
import {
  getDayStatus,
  statusVerdict,
  fmtClock,
  assessCompetitors,
  getWindows,
  computeSignal,
} from '../utils/horizonData'
import { GAPS_T1, TABLE_DATA } from '../data/staticData'
import { intelKit } from '../utils/intelKit'
import { Card, FONT_HEAD, FONT_BODY, FONT_MONO } from './horizonUI'
import SiteTable from './SiteTable'

// STATUS — Mix4 + Rust restyle. Sections in render order:
//   1. SIGNAL bar (PREPARE rust badge + body + % right)
//   2. INTELLIGENCE — All URLs (cyan accent, inline tags)
//   3. EXEC pills (GAP rust · THREAT rust-dark · WINDOW cyan · WIN emerald)
//   4. HIGH PRESSURE block (rust gradient, 5 signals + intel stack)

const VERDICT_KEY = 'horizon_status_verdict'
const DAY = 86400000

// Per-verdict palette mapping for the SIGNAL VERDICT block.
// DEPLOY = emerald (active win); HOLD = cyan (intel/data); PREPARE = lime
// (monitored/staged); WAIT = muted (no signal).
const VERDICT_TONE = {
  DEPLOY:  { color: '#0dbe82', rgb: '13,190,130' },
  HOLD:    { color: '#18b4d4', rgb: '24,180,212' },
  PREPARE: { color: '#70a848', rgb: '112,168,72' },
  WAIT:    { color: '#8892a4', rgb: '136,146,164' },
}

// Confidence-pill colour ramp per spec — >80% emerald, 60–80 lime, <60 rust.
function confidenceColor(pct) {
  if (pct > 80) return { color: '#0dbe82', rgb: '13,190,130' }
  if (pct >= 60) return { color: '#70a848', rgb: '112,168,72' }
  return { color: '#e8703a', rgb: '232,112,58' }
}

// Threat level derivation + colour. Pressure 0–100 maps to LOW/MEDIUM/HIGH/CRITICAL.
function threatFromPressure(pressure) {
  const p = Number(pressure) || 0
  if (p >= 85) return { level: 'CRITICAL', color: '#ff4d6d', rgb: '255,77,109' }
  if (p >= 70) return { level: 'HIGH',     color: '#e8703a', rgb: '232,112,58' }
  if (p >= 40) return { level: 'MEDIUM',   color: '#18b4d4', rgb: '24,180,212' }
  return { level: 'LOW', color: '#70a848', rgb: '112,168,72' }
}

// Format an ISO timestamp to "HH:MM:SS UTC" — used in telemetry log tail.
function fmtFullClockUtc(iso) {
  try {
    const d = iso ? new Date(iso) : new Date()
    const hh = String(d.getUTCHours()).padStart(2, '0')
    const mm = String(d.getUTCMinutes()).padStart(2, '0')
    const ss = String(d.getUTCSeconds()).padStart(2, '0')
    return `${hh}:${mm}:${ss} UTC`
  } catch {
    return '— UTC'
  }
}

// Per-signal-label dot colour for the HIGH PRESSURE left column (5 rows).
// Falls back to the RAG colour from the data layer if a label isn't mapped.
const SIGNAL_DOT = {
  'Competitor Activity':  { color: 'var(--rust-dark)', glow: true,  pulse: false },
  'Market Sentiment':     { color: 'var(--rust)',      glow: true,  pulse: true  },
  'Regulatory Noise':     { color: 'var(--emerald)',   glow: true,  pulse: false },
  'Upcoming Windows':     { color: 'var(--cyan)',      glow: true,  pulse: false },
  'Brand Events':         { color: 'var(--emerald-light)', glow: true, pulse: false },
  'Team Execution':       { color: 'var(--emerald-light)', glow: true, pulse: false },
}

// Section labels — locked Geist Mono 10px / 0.12em / muted.
const sectionLabel = {
  fontFamily: FONT_MONO,
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
}

export default function StatusBoard({
  onDismiss,
  onAskIntel,
  onAskQuestion,
  onNav,
  onScan,
  scanState = 'idle',
  hasScanData = false,
  scanData = null,
  // eslint-disable-next-line no-unused-vars
  liveCompetitors,
  liveCoverage,
  // eslint-disable-next-line no-unused-vars
  onOpenCompetitorPanel,
}) {
  const [intelOpen, setIntelOpen] = useState(false)
  const [addUrlOpen, setAddUrlOpen] = useState(false)
  const [addUrlValue, setAddUrlValue] = useState('')
  const [dismissOpen, setDismissOpen] = useState(false)

  const tableData = TABLE_DATA
  const gapData = GAPS_T1
  const effectiveHasScanData =
    hasScanData ||
    (tableData && tableData.length > 0) ||
    (gapData && gapData.length > 0)

  const submitAddUrl = () => {
    const url = addUrlValue.trim()
    if (!url || !onAskQuestion) return
    onAskQuestion(`Please add this URL to tracking: ${url}`)
    setAddUrlValue('')
    setAddUrlOpen(false)
  }

  const suggestCandidateUrls = () => {
    if (!onAskQuestion) return
    onAskQuestion('Which URLs should we add to tracking to close our biggest coverage gaps?')
  }

  const handleScanClick = () => {
    if (!onScan || scanState !== 'idle') return
    toast('Scan initiated — monitoring 60 sites')
    onScan()
  }

  const { signals, overall, updatedAt } = useMemo(() => getDayStatus(), [])
  const verdict = statusVerdict(overall)
  const sig = useMemo(() => computeSignal(), [])
  const verdictKey = VERDICT_TONE[sig.verdict] ? sig.verdict : 'WAIT'
  const tone = VERDICT_TONE[verdictKey]
  const confTone = confidenceColor(sig.confidence)
  const fieldAssessment = useMemo(() => assessCompetitors(), [])
  const threat = threatFromPressure(fieldAssessment?.pressure)
  const actionsConfirmed = useMemo(
    () => (signals || []).filter((s) => s.rag === 'red' || s.rag === 'amber').length,
    [signals],
  )
  const marketMoving = (Number(fieldAssessment?.pressure) || 0) >= 60

  // Intel layer — drivers / actions / since-yesterday from live field + windows + gaps.
  const intel = useMemo(() => {
    const field = assessCompetitors()
    const { rows, moveNowCount } = getWindows(90)
    const t1 = GAPS_T1 || []
    const g1 = t1[0]
    const g2 = t1[1]
    const dom = g => (g ? `${g.domain}` : '—')

    const why = [
      'WhiteBit — FC Barcelona sponsorship confirmed. T1 brand event in your primary markets.',
      `Threat score: ${field.pressure}/100 — field pressure ${field.level}, ${field.top} leading.`,
      `${t1.length} T1 gaps uncontacted (incl. ${dom(g1)}, ${dom(g2)}).`,
    ]

    const g1Url = g1 ? `${g1.domain}${g1.url?.slice(g1.domain.length) || ''}` : null
    const actions = [
      {
        url: g1Url,
        urlKind: 'gap',
        prefix: 'Contact ',
        tail: ` — T1 ${g1?.country || 'Global'}, ${(g1?.competitors || ['competitor'])[0]} listed`,
        nav: 'network',
      },
      {
        url: 'investopedia.com',
        urlKind: 'gap',
        prefix: 'Review ',
        tail: ' outreach — sent, no response logged',
        nav: 'outcomes',
      },
    ]

    const since = [
      'WhiteBit Barcelona deal announced — field threat level elevated',
      'Activation rate: 1 this week (finder.com win logged)',
      moveNowCount
        ? `${moveNowCount} MOVE-rated window(s) on the 90-day horizon`
        : 'No new competitor placements detected on tracked pages',
    ]

    return { why, actions, since }
  }, [])

  // Executive summary — live 3 points (GAP / THREAT / WINDOW). Recolored per spec.
  const execSummary = useMemo(() => {
    const clamp12 = s => {
      const w = String(s).trim().split(/\s+/).filter(Boolean)
      return w.length <= 12 ? w.join(' ') : w.slice(0, 12).join(' ') + '…'
    }
    const points = []

    const g = (GAPS_T1 || [])[0]
    if (g) {
      const rivals = (g.competitors || []).slice(0, 2).join(', ')
      points.push({
        label: 'GAP',
        text: clamp12(`${g.domain} (${g.country}) — ${rivals ? rivals + ' listed, ' : ''}Bybit absent`),
      })
    }
    const field = assessCompetitors()
    if (field?.top && field.top !== '—') {
      points.push({
        label: 'THREAT',
        text: clamp12(`${field.top} leads field — pressure ${field.pressure}/100 (${field.level})`),
      })
    }
    const win = getWindows(90).rows.find(w => w.action === 'MOVE NOW')
    if (win) {
      points.push({
        label: 'WINDOW',
        text: clamp12(`${win.event.name} — MOVE NOW in ${win.daysOut}d`),
      })
    }
    return points
  }, [])

  // Optional WIN pill — appears only when the dashboard reports any confirmed Bybit presence.
  const winPill = liveCoverage?.present > 0
    ? { label: 'WIN', text: `${liveCoverage.present}/${liveCoverage.tracked} Bybit-present (${liveCoverage.pct}%)` }
    : null

  const execAll = winPill ? [...execSummary, winPill] : execSummary

  // Recoloured exec pill mapping per spec.
  const EXEC_TONE = {
    GAP:    { color: 'var(--rust)',      rgb: '232,112,58' },
    THREAT: { color: 'var(--rust-dark)', rgb: '196,97,42' },
    WINDOW: { color: 'var(--cyan)',      rgb: '24,180,212' },
    WIN:    { color: 'var(--emerald)',   rgb: '13,190,130' },
  }

  // Days the day verdict has held (seeded 3d baseline).
  const verdictDays = useMemo(() => {
    const now = Date.now()
    let rec = null
    try { rec = JSON.parse(localStorage.getItem(VERDICT_KEY) || 'null') } catch { rec = null }
    if (!rec || rec.label !== verdict.label) {
      rec = { label: verdict.label, since: now - 3 * DAY }
      try { localStorage.setItem(VERDICT_KEY, JSON.stringify(rec)) } catch { /* ignore */ }
    }
    return Math.max(0, Math.round((now - rec.since) / DAY))
  }, [verdict.label])

  const intelContext = () =>
    `You are reviewing the morning status board. Verdict: ${verdict.label} (held ${verdictDays}d). Signals — ${signals
      .map(s => `${s.label}: ${s.rag.toUpperCase()} (${s.note})`)
      .join('; ')}.`

  const askIntel = () => onAskIntel(intelContext(), intelKit.status({ label: verdict.label, days: verdictDays }))

  return (
    <Tooltip.Provider delayDuration={150}>
    <Card style={{ padding: '8px 24px 22px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 3 }}>
      {/* ── 1a. LIVE RADAR BAR — improvement 3 ────────────────────────── */}
      <LiveRadarBar scanState={scanState} />

      {/* ── 1b. SIGNAL VERDICT block — improvement 2 ───────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut', delay: 0.25 }}
        style={{
          background: 'var(--bg-card)',
          border: `1px solid rgba(255,255,255,0.07)`,
          borderLeft: `3px solid ${tone.color}`,
          borderRadius: 3,
          padding: 16,
          marginTop: 12,
          marginBottom: 18,
          display: 'grid',
          gridTemplateColumns: '60% 40%',
        }}
      >
        {/* LEFT — label + big verdict + badges */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 16 }}>
          <div style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}>
            SIGNAL VERDICT
          </div>
          <div style={{
            fontFamily: FONT_HEAD,
            fontSize: 36,
            fontWeight: 800,
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
            lineHeight: 1,
            color: tone.color,
          }}>
            {verdictKey}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
            <span style={{
              fontFamily: FONT_MONO,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.1em',
              padding: '3px 8px',
              borderRadius: 3,
              background: `rgba(${confTone.rgb},0.10)`,
              color: confTone.color,
              border: `1px solid rgba(${confTone.rgb},0.4)`,
            }}>
              CONFIDENCE: {sig.confidence}%
            </span>
            <span style={{
              fontFamily: FONT_MONO,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.1em',
              padding: '3px 8px',
              borderRadius: 3,
              background: `rgba(${threat.rgb},0.10)`,
              color: threat.color,
              border: `1px solid rgba(${threat.rgb},0.4)`,
            }}>
              THREAT: {threat.level}
            </span>
          </div>
        </div>

        {/* RIGHT — stats column */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 14,
          padding: 14,
          borderLeft: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
              Actions confirmed
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 22, fontWeight: 700, color: '#0dbe82', lineHeight: 1 }}>
              {actionsConfirmed}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
              Market moving
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 16, fontWeight: 700, color: marketMoving ? '#e8703a' : '#0dbe82', lineHeight: 1 }}>
              {marketMoving ? 'YES' : 'NO'}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── 1c. TELEMETRY LOG — improvement 5 (conditional on scan in-flight) ── */}
      <TelemetryLog scanState={scanState} scanData={scanData} threatLevel={threat.level} verdictWord={verdictKey} />

      {/* ── 2. INTELLIGENCE — All URLs ────────────────────────────────── */}
      {(() => {
        const ghostBtn = {
          fontFamily: FONT_MONO,
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 3,
          padding: '6px 10px',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'color 0.15s, border-color 0.15s',
        }
        const stop = e => e.stopPropagation()

        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, delay: 0.35 }}
          >
            <div
              onClick={() => setIntelOpen(o => !o)}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIntelOpen(o => !o) } }}
              aria-expanded={intelOpen}
              aria-label={intelOpen ? 'Collapse intelligence' : 'Expand intelligence'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: 'rgba(24,180,212,0.05)',
                border: '1px solid rgba(24,180,212,0.15)',
                borderRadius: 3,
                padding: '10px 12px',
                marginTop: 8,
                flexWrap: 'wrap',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  ...sectionLabel,
                  color: 'var(--cyan)',
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  marginRight: 6,
                  flexShrink: 0,
                }}
              >
                INTELLIGENCE — ALL URLS
              </span>

              <button
                onClick={e => { stop(e); setAddUrlOpen(o => !o); if (!intelOpen) setIntelOpen(true) }}
                style={{
                  ...ghostBtn,
                  color: addUrlOpen ? 'var(--cyan)' : 'var(--text-muted)',
                  borderColor: addUrlOpen ? 'rgba(24,180,212,0.4)' : 'var(--border)',
                }}
              >
                + Add URL
              </button>
              <button
                onClick={e => { stop(e); suggestCandidateUrls() }}
                disabled={!onAskQuestion}
                style={{
                  ...ghostBtn,
                  color: onAskQuestion ? 'var(--text-muted)' : 'var(--border)',
                  cursor: onAskQuestion ? 'pointer' : 'default',
                }}
              >
                Suggest Candidate URLs
              </button>

              <span style={{ flex: 1 }} />

              <ChevronDown
                size={14}
                strokeWidth={1.75}
                aria-hidden="true"
                style={{
                  color: 'var(--text-muted)',
                  transform: intelOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                  flexShrink: 0,
                }}
              />
            </div>

            {intelOpen && addUrlOpen && (
              <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="url"
                  placeholder="https://example.com/page-to-track"
                  value={addUrlValue}
                  onChange={e => setAddUrlValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      submitAddUrl()
                    }
                  }}
                  style={{
                    flex: 1,
                    fontFamily: FONT_MONO,
                    fontSize: 12,
                    color: '#ffffff',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 3,
                    padding: '8px 10px',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={submitAddUrl}
                  disabled={!addUrlValue.trim() || !onAskQuestion}
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 10,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--emerald)',
                    background: 'transparent',
                    border: '1px solid rgba(13,190,130,0.4)',
                    borderRadius: 3,
                    padding: '7px 12px',
                    cursor: addUrlValue.trim() && onAskQuestion ? 'pointer' : 'default',
                    opacity: addUrlValue.trim() && onAskQuestion ? 1 : 0.4,
                  }}
                >
                  Add
                </button>
              </div>
            )}

            {intelOpen && (
              <div style={{ marginTop: 14 }}>
                <IntelSyncBar urlCount={(TABLE_DATA || []).length} />
                <SiteTable openWithQuestion={q => onAskIntel(q, { chips: [q] })} />
              </div>
            )}
          </motion.div>
        )
      })()}

      {/* ── 3. EXEC pills row ────────────────────────────────────────── */}
      {execAll.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18, marginBottom: 18 }}>
          {execAll.map((p, i) => {
            const t = EXEC_TONE[p.label] || EXEC_TONE.GAP
            return (
              <motion.div
                key={p.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.4 + i * 0.06 }}
                whileHover={{ backgroundColor: `rgba(${t.rgb},0.08)` }}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 8,
                  background: `rgba(${t.rgb},0.06)`,
                  border: `1px solid rgba(${t.rgb},0.18)`,
                  borderRadius: 3,
                  padding: '7px 12px',
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  minWidth: 0,
                }}
              >
                <span style={{ color: t.color, fontWeight: 700, letterSpacing: '0.12em', flexShrink: 0 }}>
                  {p.label}
                </span>
                <span style={{ color: 'var(--text-body)' }}>{p.text}</span>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Empty-state notice — surfaces only when there's truly no scan data. */}
      {!effectiveHasScanData && (
        <div
          style={{
            marginTop: 10,
            background: 'rgba(13,190,130,0.06)',
            border: '1px solid rgba(13,190,130,0.25)',
            borderRadius: 3,
            padding: '10px 14px',
            fontFamily: FONT_MONO,
            fontSize: 11,
            color: 'var(--text-body)',
            letterSpacing: '0.04em',
          }}
        >
          No scan data yet — run the first crawl to populate live presence, gaps and competitor data.
        </div>
      )}

      {/* ── 4. HIGH PRESSURE block ───────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut', delay: 0.4 }}
        style={{
          background: 'linear-gradient(135deg, rgba(232,112,58,0.06) 0%, rgba(15,20,34,0.97) 55%)',
          border: '1px solid rgba(232,112,58,0.15)',
          boxShadow: 'inset 0 1px 0 rgba(232,112,58,0.08)',
          borderRadius: 3,
          padding: 14,
        }}
      >
        {/* Headline row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            paddingBottom: 14,
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                background: 'var(--rust)',
                animation: 'novaPulse 1.5s ease-in-out infinite',
                flexShrink: 0,
              }}
            />
            <div>
              <div
                style={{
                  fontFamily: FONT_HEAD,
                  fontWeight: 800,
                  fontSize: 22,
                  letterSpacing: '0.06em',
                  color: 'var(--rust)',
                  textShadow: '0 0 16px rgba(232,112,58,0.25)',
                }}
              >
                {verdict.label}
              </div>
              <div
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  marginTop: 2,
                }}
              >
                90-second operational read · five signals
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
              UPDATED {fmtClock(updatedAt)}
            </span>
            {onScan && (
              <motion.button
                onClick={handleScanClick}
                disabled={scanState !== 'idle'}
                whileHover={scanState === 'idle' ? { scale: 1.01, boxShadow: '0 0 20px rgba(13,190,130,0.25)' } : {}}
                transition={{ duration: 0.15 }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: FONT_MONO,
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: scanState === 'error' ? 'var(--red)' : 'var(--emerald)',
                  background: 'transparent',
                  border: `1px solid ${scanState === 'error' ? 'rgba(255,77,109,0.4)' : 'rgba(13,190,130,0.4)'}`,
                  borderRadius: 3,
                  padding: '7px 12px',
                  cursor: scanState === 'idle' ? 'pointer' : 'default',
                  boxShadow: '0 0 14px rgba(13,190,130,0.15)',
                  opacity: scanState === 'idle' ? 1 : 0.7,
                }}
              >
                <Radar size={11} strokeWidth={2} />
                {scanState === 'idle' ? 'SCAN NOW' : scanState === 'complete' ? 'COMPLETE' : scanState === 'error' ? 'OFFLINE' : 'SCANNING…'}
              </motion.button>
            )}
            {onAskIntel && (
              <motion.button
                onClick={askIntel}
                title="Ask C0insiglieri about this section"
                whileHover={{ borderColor: 'rgba(24,180,212,0.55)' }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: FONT_MONO,
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--cyan)',
                  background: 'transparent',
                  border: '1px solid rgba(24,180,212,0.35)',
                  borderRadius: 3,
                  padding: '7px 12px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.15s',
                }}
              >
                <Hexagon size={11} strokeWidth={2} />
                Ask C0insiglieri
              </motion.button>
            )}
            <Dialog.Root open={dismissOpen} onOpenChange={setDismissOpen}>
              <Dialog.Trigger asChild>
                <button
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: 3,
                    padding: '7px 12px',
                    cursor: 'pointer',
                    transition: 'color 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = '#c8d0dc'
                    e.currentTarget.style.borderColor = 'var(--border-active)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = 'var(--text-muted)'
                    e.currentTarget.style.borderColor = 'var(--border)'
                  }}
                >
                  Dismiss
                </button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay
                  style={{
                    position: 'fixed', inset: 0, zIndex: 5000,
                    background: 'rgba(0,0,0,0.55)',
                    backdropFilter: 'blur(2px)',
                  }}
                />
                <Dialog.Content
                  role="alertdialog"
                  style={{
                    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                    zIndex: 5001,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-active)',
                    borderRadius: 3,
                    padding: 18,
                    maxWidth: 380,
                    width: '90vw',
                    boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
                  }}
                >
                  <Dialog.Title
                    style={{
                      fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700,
                      letterSpacing: '0.14em', textTransform: 'uppercase',
                      color: 'var(--rust)', marginBottom: 10,
                    }}
                  >
                    Dismiss STATUS?
                  </Dialog.Title>
                  <Dialog.Description
                    style={{
                      fontFamily: FONT_BODY, fontSize: 13,
                      color: 'var(--text-body)', lineHeight: 1.5, marginBottom: 16,
                    }}
                  >
                    The board will hide for the rest of today. It will re-open tomorrow on first visit.
                  </Dialog.Description>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <Dialog.Close asChild>
                      <button
                        style={{
                          fontFamily: FONT_MONO, fontSize: 10, fontWeight: 600,
                          letterSpacing: '0.12em', textTransform: 'uppercase',
                          color: 'var(--text-muted)',
                          background: 'transparent',
                          border: '1px solid var(--border)',
                          borderRadius: 3,
                          padding: '7px 14px',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </Dialog.Close>
                    <button
                      onClick={() => { setDismissOpen(false); onDismiss?.() }}
                      style={{
                        fontFamily: FONT_MONO, fontSize: 10, fontWeight: 600,
                        letterSpacing: '0.12em', textTransform: 'uppercase',
                        color: 'var(--rust)',
                        background: 'transparent',
                        border: '1px solid rgba(232,112,58,0.45)',
                        borderRadius: 3,
                        padding: '7px 14px',
                        cursor: 'pointer',
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          </div>
        </div>

        {/* Two-column body: signals (left) + intel stack (right) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 24,
            alignItems: 'start',
          }}
        >
          {/* LEFT — 5 signal rows */}
          <div style={{
            background: 'rgba(3,4,10,0.7)',
            border: '1px solid rgba(255,255,255,0.04)',
            borderRadius: 3,
            padding: 14,
          }}>
            {signals.map((s, i) => {
              const dot = SIGNAL_DOT[s.label] || { color: 'var(--text-muted)', glow: false, pulse: false }
              return (
                <Tooltip.Root key={s.label}>
                  <Tooltip.Trigger asChild>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 6px',
                        borderLeft: '2px solid transparent',
                        borderBottom: i < signals.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        transition: 'transform 0.15s ease, border-color 0.15s ease',
                        cursor: 'default',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-1px)'
                        e.currentTarget.style.borderLeftColor = dot.color
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.borderLeftColor = 'transparent'
                      }}
                    >
                      <span
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: '50%',
                          background: dot.color,
                          boxShadow: dot.glow ? `0 0 8px ${dot.color}` : 'none',
                          animation: dot.pulse ? 'rustPulseSoft 2.5s ease-in-out infinite' : 'none',
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          flex: '0 0 175px',
                          fontFamily: FONT_BODY,
                          fontSize: 13,
                          color: 'var(--white)',
                        }}
                      >
                        {s.label}
                      </span>
                      <span
                        style={{
                          flex: 1,
                          fontFamily: FONT_MONO,
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {s.note}
                      </span>
                    </div>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      side="top"
                      sideOffset={6}
                      style={{
                        background: '#0f1422',
                        border: '1px solid var(--border-active)',
                        borderLeft: `2px solid ${dot.color}`,
                        borderRadius: 3,
                        padding: '8px 12px',
                        fontFamily: FONT_MONO,
                        fontSize: 11,
                        color: 'var(--text-body)',
                        maxWidth: 320,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                      }}
                    >
                      <div style={{ fontWeight: 700, color: dot.color, marginBottom: 3, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 9 }}>
                        {s.rag}
                      </div>
                      {s.note}
                      <Tooltip.Arrow style={{ fill: '#0f1422' }} />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              )
            })}
          </div>

          {/* RIGHT — WHY TODAY / SINCE YESTERDAY / RECOMMENDED ACTIONS */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            background: 'rgba(3,4,10,0.7)',
            border: '1px solid rgba(255,255,255,0.04)',
            borderRadius: 3,
            padding: 14,
          }}>
            <IntelSection label={`WHY TODAY IS ${verdict.label}`} lines={intel.why} />
            <IntelSection label="SINCE YESTERDAY" lines={intel.since} />
            <IntelActions label="RECOMMENDED ACTIONS TODAY" actions={intel.actions} onNav={onNav} />
          </div>
        </div>
      </motion.div>
    </Card>
    </Tooltip.Provider>
  )
}

function IntelSection({ label, lines }) {
  return (
    <div>
      <div style={{ ...sectionLabel, marginBottom: 10 }}>{label}</div>
      {lines.map((l, i) => (
        <div
          key={i}
          style={{
            fontFamily: FONT_BODY,
            fontSize: 13,
            color: 'var(--text-body)',
            lineHeight: 1.55,
            padding: '3px 0',
          }}
        >
          {l}
        </div>
      ))}
    </div>
  )
}

function IntelActions({ label, actions, onNav }) {
  return (
    <div>
      <div style={{ ...sectionLabel, marginBottom: 10 }}>{label}</div>
      {actions.map((a, i) => {
        const linkHref = a.url
          ? (a.url.startsWith('http') ? a.url : `https://${a.url}`)
          : null
        return (
          <div
            key={i}
            role="button"
            tabIndex={0}
            onClick={() => onNav?.(a.nav)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onNav?.(a.nav)
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              textAlign: 'left',
              background: 'transparent',
              border: 'none',
              borderBottom: i < actions.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              padding: '9px 0',
              cursor: 'pointer',
              fontFamily: FONT_BODY,
              fontSize: 13,
              color: 'var(--text-body)',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ffffff' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-body)' }}
          >
            <span style={{ color: 'var(--emerald)', fontWeight: 700, flexShrink: 0, fontFamily: FONT_MONO, fontSize: 12 }}>
              {i + 1}.
            </span>
            <span style={{ flex: 1 }}>
              {a.url ? (
                <>
                  {a.prefix || ''}
                  <a
                    href={linkHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    title={`Open ${a.url}`}
                    style={{ color: 'var(--cyan)', textDecoration: 'none', cursor: 'pointer' }}
                    onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
                    onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}
                  >
                    {a.url}
                  </a>
                  {a.tail || ''}
                </>
              ) : (
                a.text
              )}
            </span>
            <span style={{ color: 'var(--emerald)', flexShrink: 0 }}>→</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── LIVE RADAR BAR ───────────────────────────────────────────────────────────
// Improvement 3 — full-width single-line separator between the stats cards
// and the SIGNAL VERDICT block. TPS/latency/uptime are stable demo values;
// the trailing sync-state line flips between SYNCING / STABLE based on
// scanState.
function LiveRadarBar({ scanState }) {
  const isScanning =
    scanState && scanState !== 'idle' && scanState !== 'complete' && scanState !== 'error'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        height: 32,
        padding: '0 14px',
        background: 'rgba(255,255,255,0.02)',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        marginTop: 6,
        fontFamily: FONT_MONO,
        fontSize: 10,
        letterSpacing: '0.06em',
      }}
    >
      <span style={{ color: '#0dbe82', animation: 'radarPulse 2s ease-in-out infinite', fontWeight: 700 }}>
        ((·))
      </span>
      <span style={{ color: '#0dbe82', letterSpacing: '0.1em', fontWeight: 600 }}>
        LIVE RADAR ACTIVE
      </span>
      <span style={{ flex: 1 }} />
      <span style={{ color: '#8892a4' }}>TPS: <span style={{ color: '#b8c4d4' }}>4.2k</span></span>
      <span style={{ color: 'rgba(255,255,255,0.1)' }}>·</span>
      <span style={{ color: '#8892a4' }}>LATENCY: <span style={{ color: '#b8c4d4' }}>12ms</span></span>
      <span style={{ color: 'rgba(255,255,255,0.1)' }}>·</span>
      <span style={{ color: '#8892a4' }}>UPTIME: <span style={{ color: '#b8c4d4' }}>99.9%</span></span>
      <span style={{ color: 'rgba(255,255,255,0.1)' }}>·</span>
      {isScanning ? (
        <span style={{ color: '#70a848' }}>SYNCING LIVE CHANNEL…</span>
      ) : (
        <span style={{ color: '#8892a4' }}>ALL CHANNELS STABLE</span>
      )}
    </div>
  )
}

// ─── INTELLIGENCE SYNC BAR ───────────────────────────────────────────────────
// Improvement 8 — small sync line above the URL list inside Intelligence.
function IntelSyncBar({ urlCount }) {
  const [now, setNow] = useState(() => fmtFullClockUtc())
  useEffect(() => {
    const id = setInterval(() => setNow(fmtFullClockUtc()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: FONT_MONO,
        fontSize: 9,
        color: '#8892a4',
        letterSpacing: '0.06em',
        padding: '6px 10px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 3,
        marginBottom: 10,
      }}
    >
      <span style={{ color: '#70a848' }}>SYNCING LIVE CHANNEL…</span>
      <span style={{ color: 'rgba(255,255,255,0.12)' }}>·</span>
      <span>{urlCount} URLS INDEXED</span>
      <span style={{ color: 'rgba(255,255,255,0.12)' }}>·</span>
      <span>LAST UPDATE: <span style={{ color: '#b8c4d4' }}>{now}</span></span>
    </div>
  )
}

// ─── TELEMETRY LOG ───────────────────────────────────────────────────────────
// Improvement 5 — terminal-style log that surfaces during scan + just after
// completion. Lines are revealed sequentially via a setTimeout chain; the
// final SCAN_COMPLETE arrives, then the block auto-hides after 800ms so the
// existing ScanResultsPanel reveal animation owns the post-scan view.
function TelemetryLog({ scanState, scanData, threatLevel, verdictWord }) {
  const [lines, setLines] = useState([])
  const [visible, setVisible] = useState(false)
  const timersRef = useRef([])

  const clearTimers = () => {
    timersRef.current.forEach((id) => clearTimeout(id))
    timersRef.current = []
  }

  const isInFlight =
    scanState === 'sentry' || scanState === 'mirror' || scanState === 'herald'
  const isComplete = scanState === 'complete'

  useEffect(() => {
    if (!isInFlight && !isComplete) {
      // Reset state when idle/error so the next scan starts from a clean slate.
      clearTimers()
      setLines([])
      setVisible(false)
      return
    }

    setVisible(true)

    // First time entering an in-flight state for this scan — initialise the
    // staggered reveal sequence. We let the sequence finish even if scanState
    // transitions; the final SCAN_COMPLETE line uses fresh scanData.
    if (isInFlight && lines.length === 0) {
      const seq = [
        { text: '[LOGS] INIT_SCAN_SEQUENCE… OK',         kind: 'ok' },
        { text: '[LOGS] CONNECTING TO BACKEND… OK',      kind: 'ok' },
        { text: '[LOGS] FETCHING_COMPETITOR_FEED… OK',   kind: 'ok' },
        { text: '[LOGS] ANALYZING_GAPS… IN PROGRESS',    kind: 'progress' },
        { text: '[LOGS] PROCESSING_SIGNAL_DATA… IN PROGRESS', kind: 'progress' },
      ]
      let acc = 0
      seq.forEach((line, i) => {
        acc += 280 + (i % 2 === 0 ? 80 : 160)
        timersRef.current.push(setTimeout(() => {
          setLines((prev) => [...prev, line])
        }, acc))
      })
    }

    if (isComplete) {
      // Append the completion-tail lines, then auto-hide after a beat so the
      // existing ScanResultsPanel reveal owns the post-scan view.
      const gaps = scanData?.gaps?.length ?? 0
      const wins = scanData?.wins ?? 0
      const tail = [
        { text: `[LOGS] THREAT_SCAN: ${threatLevel || 'LOW'}`, kind: 'default' },
        { text: `[LOGS] GAPS_IDENTIFIED: ${gaps}`, kind: 'default' },
        { text: `[LOGS] WINS_DETECTED: ${wins}`,   kind: 'default' },
        { text: `[LOGS] SIGNAL_LOCKED: ${verdictWord || '—'}`, kind: 'default' },
        { text: `[LOGS] SCAN_COMPLETE — ${fmtFullClockUtc(scanData?.scannedAt)}`, kind: 'complete' },
      ]
      let acc = 0
      tail.forEach((line, i) => {
        acc += 220
        timersRef.current.push(setTimeout(() => {
          setLines((prev) => [...prev, line])
        }, acc))
      })
      // Auto-hide after the chain settles.
      timersRef.current.push(setTimeout(() => {
        setVisible(false)
      }, acc + 800))
    }

    return clearTimers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInFlight, isComplete])

  // Auto-scroll the log to its tail as new lines arrive.
  const logRef = useRef(null)
  useEffect(() => {
    if (!logRef.current) return
    logRef.current.scrollTop = logRef.current.scrollHeight
  }, [lines])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="telemetry"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          ref={logRef}
          style={{
            marginBottom: 18,
            background: '#080b16',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 3,
            padding: 14,
            fontFamily: FONT_MONO,
            fontSize: 11,
            lineHeight: 1.55,
            height: 160,
            overflow: 'auto',
          }}
        >
          {lines.map((line, i) => {
            let color = '#8892a4'
            let suffix = null
            if (line.kind === 'complete') color = '#0dbe82'
            else if (line.kind === 'error') color = '#ff4d6d'
            else if (line.kind === 'progress') {
              color = '#8892a4'
              suffix = (
                <span style={{ color: '#18b4d4', marginLeft: 2, animation: 'telemetryCursor 1s steps(1) infinite' }}>
                  ▋
                </span>
              )
            }
            // For "OK" / "IN PROGRESS" tails, recolour the suffix inline.
            const okMatch = line.text.match(/^(.*) (OK)$/)
            const ipMatch = line.text.match(/^(.*) (IN PROGRESS)$/)
            if (okMatch) {
              return (
                <div key={i} style={{ color }}>
                  {okMatch[1]} <span style={{ color: '#0dbe82', fontWeight: 700 }}>OK</span>
                </div>
              )
            }
            if (ipMatch) {
              return (
                <div key={i} style={{ color }}>
                  {ipMatch[1]} <span style={{ color: '#18b4d4', fontWeight: 700 }}>IN PROGRESS</span>{suffix}
                </div>
              )
            }
            return <div key={i} style={{ color }}>{line.text}</div>
          })}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
