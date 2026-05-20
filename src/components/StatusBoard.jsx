import { useState, useMemo } from 'react'
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
import { Card, RagDot, AskIntelButton, FONT_HEAD, FONT_BODY, FONT_MONO } from './horizonUI'
import SignalPanel, { VERDICT } from './SignalPanel'
import CompetitorChart from './CompetitorChart'
import CustomCompetitors from './CustomCompetitors'
import SiteTable from './SiteTable'
import { supabase, getActiveOrgId } from '../lib/supabase'

// P2 — Morning Status Board. 90-second daily briefing. Verdict reframed:
// HIGH PRESSURE / ELEVATED WATCH (cyan) · ALL CLEAR (lime). No crisis red.

const VERDICT_KEY = 'horizon_status_verdict'
const DAY = 86400000
const BACKEND =
  import.meta.env.VITE_BACKEND_URL || 'https://web-production-e204.up.railway.app'

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
  // Unified intelligence section — COMPETITORS / ALL URLS are tabs, collapsed
  // by default, modeled on HistoryPanel's tab pattern.
  const [intelOpen, setIntelOpen] = useState(false)
  const [intelTab, setIntelTab] = useState('competitors')
  const [addUrlOpen, setAddUrlOpen] = useState(false)
  const [addUrlValue, setAddUrlValue] = useState('')
  const [addCompetitorOpen, setAddCompetitorOpen] = useState(false)
  const [addCompetitorValue, setAddCompetitorValue] = useState('')

  // Banner gate: hide whenever ANY data is populating the UI. The seeded
  // table/gap data is what the user actually sees, so an empty notice while
  // those have entries reads as stale.
  const tableData = TABLE_DATA
  const gapData = GAPS_T1
  const effectiveHasScanData =
    hasScanData ||
    (tableData && tableData.length > 0) ||
    (gapData && gapData.length > 0)
  // Internal scan state — StatusBoard owns the scan trigger so the button
  // keeps working even if the App → HorizonView → StatusBoard prop chain
  // drops onScan/scanState during a nav refactor.
  const [localScanState, setLocalScanState] = useState('idle')
  const [localScanMsg, setLocalScanMsg] = useState(null)

  // External scanState (when present) reflects an App-level run in progress;
  // local takes precedence when the user clicked SCAN NOW from this board.
  const effectiveScanState =
    localScanState !== 'idle' ? localScanState : scanState

  async function handleScan() {
    if (effectiveScanState !== 'idle') return
    const orgId = getActiveOrgId()
    if (!orgId) {
      setLocalScanState('error')
      setLocalScanMsg('No organisation bound to this account.')
      setTimeout(() => { setLocalScanState('idle'); setLocalScanMsg(null) }, 4000)
      return
    }
    setLocalScanState('sending')
    const headers = { 'Content-Type': 'application/json' }
    try {
      const { data } = await supabase.auth.getSession()
      const t = data?.session?.access_token
      if (t) headers.Authorization = `Bearer ${t}`
    } catch { /* unauthenticated → backend will reject */ }
    try {
      const r = await fetch(`${BACKEND}/api/scan/trigger`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ org_id: orgId }),
      })
      if (!r.ok) throw new Error(`scan ${r.status}`)
      setLocalScanState('complete')
      setLocalScanMsg('✓ Scan kicked off — results refresh shortly.')
      setTimeout(() => { setLocalScanState('idle'); setLocalScanMsg(null) }, 5000)
    } catch (e) {
      setLocalScanState('error')
      setLocalScanMsg(`Scan failed: ${String(e?.message ?? e).slice(0, 80)}`)
      setTimeout(() => { setLocalScanState('idle'); setLocalScanMsg(null) }, 5000)
    }
  }

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

  const submitAddCompetitor = () => {
    const name = addCompetitorValue.trim()
    if (!name || !onAskQuestion) return
    onAskQuestion(`Please add this competitor to tracking: ${name}`)
    setAddCompetitorValue('')
    setAddCompetitorOpen(false)
  }

  const suggestCompetitors = () => {
    if (!onAskQuestion) return
    onAskQuestion('Which competitors should we add to tracking based on current market presence and our gap data?')
  }

  const activateTab = (next) => {
    setIntelTab(next)
    if (!intelOpen) setIntelOpen(true)
  }

  const scanLabel =
    effectiveScanState === 'idle'
      ? effectiveHasScanData
        ? '⟳ SCAN NOW'
        : '⟳ Run first scan'
      : effectiveScanState === 'complete'
      ? '✓ Scan complete'
      : effectiveScanState === 'error'
      ? '⚠ Agent offline'
      : '⟳ Scanning…'
  const { signals, overall, updatedAt } = useMemo(() => getDayStatus(), [])
  const verdict = statusVerdict(overall)

  // SIGNAL bar — uses the hoisted computeSignal() from horizonData.
  const sig = useMemo(() => computeSignal(), [])

  // ── Intelligence layer (S6) — drivers / actions / since-yesterday, derived
  // from the live field + windows + gap list, with seeded fallbacks that keep
  // the same shape so the board always reads as live for the demo.
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

    const actions = [
      {
        text: `Contact ${dom(g1)}${g1?.url?.slice(g1.domain.length) || ''} — T1 ${
          g1?.country || 'Global'
        }, ${(g1?.competitors || ['competitor'])[0]} listed`,
        nav: 'network',
      },
      {
        text: 'Review investopedia.com outreach — sent, no response logged',
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

  // Executive summary — exactly 3 live points from the same sources the board
  // already uses (GAPS_T1, assessCompetitors, getWindows). No static fallback:
  // a point with no data is omitted; if none resolve the bar renders nothing.
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
        text: clamp12(
          `${g.domain} (${g.country}) — ${rivals ? rivals + ' listed, ' : ''}Bybit absent`,
        ),
      })
    }

    const field = assessCompetitors()
    if (field?.top && field.top !== '—') {
      points.push({
        label: 'THREAT',
        text: clamp12(
          `${field.top} leads field — pressure ${field.pressure}/100 (${field.level})`,
        ),
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

  // How long the day verdict has held (seeded 3d baseline on first sight).
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

  const askIntel = () =>
    onAskIntel(
      intelContext(),
      intelKit.status({ label: verdict.label, days: verdictDays }),
    )

  return (
    <Card style={{ padding: '22px 28px' }}>
      {/* SIGNAL — collapsible inline panel header */}
      <button
        onClick={() => setSignalOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          width: '100%',
          textAlign: 'left',
          background: `${VERDICT[sig.verdict].color}14`,
          border: 'none',
          borderBottom: `1px solid ${VERDICT[sig.verdict].color}33`,
          padding: '14px 0',
          marginBottom: 18,
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.12em',
            padding: '4px 10px',
            borderRadius: 4,
            color: VERDICT[sig.verdict].color,
            border: `1px solid ${VERDICT[sig.verdict].color}66`,
            background: `${VERDICT[sig.verdict].color}10`,
            flexShrink: 0,
          }}
        >
          {sig.verdict}
        </span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: VERDICT[sig.verdict].color, flexShrink: 0 }}>
          {sig.confidence}%
        </span>
        <span
          style={{
            flex: 1,
            fontFamily: FONT_BODY,
            fontSize: 13,
            color: '#c8d0dc',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
        >
          {VERDICT[sig.verdict].blurb}
        </span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
          {signalOpen ? '▲' : '▼'}
        </span>
      </button>
      {signalOpen && <SignalPanel onAskIntel={onAskIntel} onNav={onNav} hideHeader />}

      {/* Executive summary bar — live, top of the STATUS view */}
      {execSummary.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 24,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '12px 18px',
            marginBottom: 18,
          }}
        >
          {execSummary.map(p => (
            <div
              key={p.label}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                fontFamily: FONT_MONO,
                fontSize: 12,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  color: 'var(--cyan)',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  flexShrink: 0,
                }}
              >
                {p.label}
              </span>
              <span style={{ color: 'var(--text-body)' }}>{p.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Headline */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          paddingBottom: 18,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: verdict.color,
              boxShadow: `0 0 8px ${verdict.color}`,
              flexShrink: 0,
            }}
          />
          <div>
            <div
              style={{
                fontFamily: FONT_HEAD,
                fontWeight: 800,
                fontSize: 24,
                letterSpacing: '0.06em',
                color: verdict.color,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: 'var(--text-muted)' }}>
            Last updated {fmtClock(updatedAt)}
          </span>
          {/* SCAN NOW is always visible in STATUS — no prop gate. handleScan
              hits /api/scan/trigger directly with the active orgId. */}
          <button
            onClick={handleScan}
            disabled={effectiveScanState !== 'idle'}
            title={localScanMsg || undefined}
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color:
                effectiveScanState === 'error'
                  ? '#ff4d6d'
                  : effectiveScanState === 'complete'
                  ? '#94c864'
                  : effectiveScanState === 'idle'
                  ? '#94c864'
                  : 'var(--text-muted)',
              background: 'transparent',
              border: `1px solid ${
                effectiveScanState === 'error'
                  ? 'rgba(255,77,109,0.4)'
                  : 'rgba(148,200,100,0.4)'
              }`,
              borderRadius: 5,
              padding: '7px 12px',
              cursor: effectiveScanState === 'idle' ? 'pointer' : 'default',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {scanLabel}
          </button>
          {onAskIntel && <AskIntelButton onClick={askIntel} />}
          <button
            onClick={onDismiss}
            style={{
              fontFamily: FONT_MONO,
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 5,
              padding: '7px 12px',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#c8d0dc'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--text-muted)'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
          >
            Dismiss
          </button>
        </div>
      </div>

      {/* Empty-state notice — surfaces only when there's truly no scan data,
          including no seeded table/gap entries. Same gate as the SCAN NOW label. */}
      {!effectiveHasScanData && (
        <div
          style={{
            marginTop: 14,
            background: 'rgba(148,200,100,0.06)',
            border: '1px solid rgba(148,200,100,0.25)',
            borderRadius: 6,
            padding: '10px 14px',
            fontFamily: FONT_MONO,
            fontSize: 11,
            color: '#c8d0dc',
            letterSpacing: '0.04em',
          }}
        >
          No scan data yet — run the first crawl to populate live presence, gaps and competitor data.
        </div>
      )}

      {/* Signal rows */}
      <div>
        {signals.map((s, i) => (
          <div
            key={s.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 0',
              borderBottom:
                i < signals.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}
          >
            <RagDot rag={s.rag} size={9} />
            <span
              style={{
                flex: '0 0 200px',
                fontFamily: FONT_BODY,
                fontSize: 14,
                color: 'var(--white)',
              }}
            >
              {s.label}
            </span>
            <span
              style={{
                flex: 1,
                fontFamily: FONT_MONO,
                fontSize: 12,
                color: 'var(--text-muted)',
              }}
            >
              {s.note}
            </span>
          </div>
        ))}
      </div>

      {/* ── S6 intelligence layer ───────────────────────────────────────────
          2-col grid: WHY + RECOMMENDED ACTIONS sit side-by-side; SINCE
          YESTERDAY spans the full row beneath. Single shared top border
          replaces the previous per-block stacked borders. */}
      <div
        style={{
          marginTop: 20,
          paddingTop: 18,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 32,
        }}
      >
        {[
          { label: `WHY TODAY IS ${verdict.label}`, lines: intel.why },
          { label: 'RECOMMENDED ACTIONS TODAY', actions: intel.actions },
          { label: 'SINCE YESTERDAY', lines: intel.since, fullWidth: true },
        ].map(sec => (
          <div
            key={sec.label}
            style={{ gridColumn: sec.fullWidth ? '1 / -1' : 'auto' }}
          >
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 11,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--cyan)',
                marginBottom: 12,
              }}
            >
              {sec.label}
            </div>

            {sec.lines &&
              sec.lines.map((l, i) => (
                <div
                  key={i}
                  style={{
                    fontFamily: FONT_BODY,
                    fontSize: 13,
                    color: '#c8d0dc',
                    lineHeight: 1.6,
                    padding: '4px 0',
                  }}
                >
                  {l}
                </div>
              ))}

            {sec.actions &&
              sec.actions.map((a, i) => (
                <button
                  key={i}
                  onClick={() => onNav?.(a.nav)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    borderBottom:
                      i < sec.actions.length - 1
                        ? '1px solid rgba(255,255,255,0.04)'
                        : 'none',
                    padding: '10px 0',
                    cursor: 'pointer',
                    fontFamily: FONT_BODY,
                    fontSize: 13,
                    color: '#c8d0dc',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--white)')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#c8d0dc')}
                >
                  <span style={{ color: '#94c864', fontWeight: 700, flexShrink: 0 }}>
                    {i + 1}.
                  </span>
                  <span style={{ flex: 1 }}>{a.text}</span>
                  <span style={{ color: '#94c864', flexShrink: 0 }}>→</span>
                </button>
              ))}
          </div>
        ))}
      </div>

      {/* INTELLIGENCE — unified tabbed section. Mirrors HistoryPanel's
          DECISIONS / OUTCOMES pattern (active=cyan, inactive=muted). Collapsed
          by default; chevron on the far right toggles the body. Per-tab
          contextual action buttons sit between the section label and the tabs. */}
      {(() => {
        const tabActive = {
          fontFamily: FONT_MONO,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          padding: '6px 14px',
          borderRadius: 4,
          border: '1px solid var(--cyan)',
          background: 'rgba(0,212,232,0.1)',
          color: 'var(--cyan)',
          cursor: 'pointer',
          flexShrink: 0,
        }
        const tabInactive = {
          fontFamily: FONT_MONO,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          padding: '6px 14px',
          borderRadius: 4,
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'transparent',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          flexShrink: 0,
        }
        const ghostBtn = {
          fontFamily: FONT_MONO,
          fontSize: 10,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 5,
          padding: '6px 10px',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'color 0.15s, border-color 0.15s',
        }

        return (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: 'rgba(0,212,232,0.06)',
                borderBottom: '1px solid rgba(0,212,232,0.15)',
                padding: '10px 12px',
                marginTop: 28,
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--cyan)',
                  flexShrink: 0,
                  marginRight: 6,
                }}
              >
                INTELLIGENCE
              </span>

              {intelTab === 'competitors' ? (
                <>
                  <button
                    onClick={() => { setAddCompetitorOpen(o => !o); if (!intelOpen) setIntelOpen(true) }}
                    style={{
                      ...ghostBtn,
                      color: addCompetitorOpen ? 'var(--cyan)' : 'var(--text-muted)',
                      borderColor: addCompetitorOpen ? 'rgba(0,212,232,0.4)' : 'var(--border)',
                    }}
                  >
                    + Add Competitor
                  </button>
                  <button
                    onClick={suggestCompetitors}
                    disabled={!onAskQuestion}
                    style={{
                      ...ghostBtn,
                      color: onAskQuestion ? 'var(--text-muted)' : 'var(--border)',
                      cursor: onAskQuestion ? 'pointer' : 'default',
                    }}
                    onMouseEnter={e => {
                      if (!onAskQuestion) return
                      e.currentTarget.style.color = '#c8d0dc'
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'
                    }}
                    onMouseLeave={e => {
                      if (!onAskQuestion) return
                      e.currentTarget.style.color = 'var(--text-muted)'
                      e.currentTarget.style.borderColor = 'var(--border)'
                    }}
                  >
                    Suggest Competitors
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { setAddUrlOpen(o => !o); if (!intelOpen) setIntelOpen(true) }}
                    style={{
                      ...ghostBtn,
                      color: addUrlOpen ? 'var(--cyan)' : 'var(--text-muted)',
                      borderColor: addUrlOpen ? 'rgba(0,212,232,0.4)' : 'var(--border)',
                    }}
                  >
                    + Add URL
                  </button>
                  <button
                    onClick={suggestCandidateUrls}
                    disabled={!onAskQuestion}
                    style={{
                      ...ghostBtn,
                      color: onAskQuestion ? 'var(--text-muted)' : 'var(--border)',
                      cursor: onAskQuestion ? 'pointer' : 'default',
                    }}
                    onMouseEnter={e => {
                      if (!onAskQuestion) return
                      e.currentTarget.style.color = '#c8d0dc'
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'
                    }}
                    onMouseLeave={e => {
                      if (!onAskQuestion) return
                      e.currentTarget.style.color = 'var(--text-muted)'
                      e.currentTarget.style.borderColor = 'var(--border)'
                    }}
                  >
                    Suggest Candidate URLs
                  </button>
                </>
              )}

              <span style={{ flex: 1 }} />

              <button
                onClick={() => activateTab('competitors')}
                style={intelTab === 'competitors' ? tabActive : tabInactive}
              >
                Competitors
              </button>
              <button
                onClick={() => activateTab('urls')}
                style={intelTab === 'urls' ? tabActive : tabInactive}
              >
                All URLs
              </button>

              <button
                onClick={() => setIntelOpen(o => !o)}
                aria-label={intelOpen ? 'Collapse intelligence' : 'Expand intelligence'}
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  background: 'transparent',
                  border: 'none',
                  padding: '6px 4px',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                {intelOpen ? '▲' : '▼'}
              </button>
            </div>

            {intelOpen && intelTab === 'competitors' && addCompetitorOpen && (
              <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Competitor name (e.g. Kraken)"
                  value={addCompetitorValue}
                  onChange={e => setAddCompetitorValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      submitAddCompetitor()
                    }
                  }}
                  style={{
                    flex: 1,
                    fontFamily: FONT_MONO,
                    fontSize: 12,
                    color: '#ffffff',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 5,
                    padding: '8px 10px',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={submitAddCompetitor}
                  disabled={!addCompetitorValue.trim() || !onAskQuestion}
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 10,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: '#94c864',
                    background: 'transparent',
                    border: '1px solid rgba(148,200,100,0.4)',
                    borderRadius: 5,
                    padding: '7px 12px',
                    cursor: addCompetitorValue.trim() && onAskQuestion ? 'pointer' : 'default',
                    opacity: addCompetitorValue.trim() && onAskQuestion ? 1 : 0.4,
                  }}
                >
                  Add
                </button>
              </div>
            )}

            {intelOpen && intelTab === 'urls' && addUrlOpen && (
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
                    borderRadius: 5,
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
                    color: '#94c864',
                    background: 'transparent',
                    border: '1px solid rgba(148,200,100,0.4)',
                    borderRadius: 5,
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
              <div style={{ marginTop: 16 }}>
                {intelTab === 'competitors' ? (
                  <>
                    <CustomCompetitors />
                    <CompetitorChart
                      liveCompetitors={liveCompetitors}
                      liveCoverage={liveCoverage}
                      onOpenPanel={onOpenCompetitorPanel}
                    />
                  </>
                ) : (
                  <SiteTable openWithQuestion={q => onAskIntel(q, { chips: [q] })} />
                )}
              </div>
            )}
          </>
        )
      })()}
    </Card>
  )
}
