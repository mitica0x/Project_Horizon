import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
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
import SignalPanel, { VERDICT } from './SignalPanel'
import SiteTable from './SiteTable'

// STATUS — Mix4 + Rust restyle. Sections in render order:
//   1. SIGNAL bar (PREPARE rust badge + body + % right)
//   2. INTELLIGENCE — All URLs (cyan accent, inline tags)
//   3. EXEC pills (GAP rust · THREAT rust-dark · WINDOW cyan · WIN emerald)
//   4. HIGH PRESSURE block (rust gradient, 5 signals + intel stack)

const VERDICT_KEY = 'horizon_status_verdict'
const DAY = 86400000

// Per-verdict palette mapping for the SIGNAL bar header — replaces SignalPanel's
// global VERDICT.color for this surface. PREPARE = rust, DEPLOY = emerald,
// HOLD = rust-dark per the strict Mix4+Rust rules.
const VERDICT_TONE = {
  DEPLOY:  { color: 'var(--emerald)',  rgb: '13,190,130' },
  PREPARE: { color: 'var(--rust)',     rgb: '232,112,58' },
  HOLD:    { color: 'var(--rust-dark)', rgb: '196,97,42' },
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
  liveCompetitors,
  liveCoverage,
  onOpenCompetitorPanel,
}) {
  const [signalOpen, setSignalOpen] = useState(false)
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
  const tone = VERDICT_TONE[sig.verdict] || VERDICT_TONE.PREPARE

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
      {/* ── 1. SIGNAL bar ─────────────────────────────────────────────── */}
      <motion.button
        onClick={() => setSignalOpen(o => !o)}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut', delay: 0.3 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          width: '100%',
          textAlign: 'left',
          background: `linear-gradient(90deg, rgba(${tone.rgb},0.06), rgba(${tone.rgb},0.02))`,
          border: `1px solid rgba(${tone.rgb},0.18)`,
          borderRadius: 3,
          padding: '12px 14px',
          marginTop: 14,
          marginBottom: 18,
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.14em',
            padding: '4px 10px',
            borderRadius: 3,
            color: tone.color,
            border: `1px solid rgba(${tone.rgb},0.4)`,
            background: `rgba(${tone.rgb},0.10)`,
            flexShrink: 0,
          }}
        >
          {sig.verdict}
        </span>
        <span
          style={{
            flex: 1,
            fontFamily: FONT_BODY,
            fontSize: 13,
            color: 'var(--text-body)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
        >
          {VERDICT[sig.verdict]?.blurb}
        </span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 700, color: tone.color, flexShrink: 0 }}>
          {sig.confidence}%
        </span>
        <ChevronDown
          size={14}
          strokeWidth={1.75}
          style={{
            color: 'var(--text-muted)',
            transform: signalOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            flexShrink: 0,
          }}
        />
      </motion.button>
      {signalOpen && <SignalPanel onAskIntel={onAskIntel} onNav={onNav} hideHeader />}

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
