import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { Circle, ChevronDown } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import HeroCanvas from './components/HeroCanvas'
import ScanResultsPanel from './components/ScanResultsPanel'
import GapCard from './components/GapCard'
import WinCard from './components/WinCard'
import OutreachPanel from './components/OutreachPanel'
import AskTheBrief from './components/AskTheBrief'
import ScopePanel from './components/ScopePanel'
import { GAPS_T1, GAPS_T2, WINS, SCORE } from './data/staticData'
import { sortItems, CRITERIA } from './utils/sortEngine'
import SortBar from './components/SortBar'
import CompetitorPanel from './components/CompetitorPanel'
import AccountMenu from './components/AccountMenu'
import { computeThreatScore } from './utils/threatScore'
import HorizonSidebar from './components/HorizonSidebar'
import StatusBoard from './components/StatusBoard'
import HorizonView from './components/HorizonView'
import Nova from './components/Nova'
import { getDayStatus, statusVerdict, assessCompetitors } from './utils/horizonData'
import { supabase, getActiveOrgId } from './lib/supabase'
import { MOCK_SCAN, MOCK_PREV_SNAPSHOT, SNAPSHOT_KEY as MOCK_SNAPSHOT_KEY } from './fixtures/mockScan'

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin)

const STATUS_VIEWED_KEY = 'horizon_last_status_viewed'
const todayKey = () => new Date().toISOString().slice(0, 10)

// Production backend (Railway). Real crawler data replaces seeded scan data.
const BACKEND =
  import.meta.env.VITE_BACKEND_URL || 'https://web-production-e204.up.railway.app'

async function authHeaders() {
  try {
    const { data } = await supabase.auth.getSession()
    const t = data?.session?.access_token
    return t ? { Authorization: `Bearer ${t}` } : {}
  } catch {
    return {}
  }
}

// Map /api/scan/latest (or /api/scan/trigger summary) → the shape
// ScanResultsPanel already consumes, so the intelligence layer keeps working.
function transformScan(payload) {
  const results = Array.isArray(payload?.results) ? payload.results : []
  const host = (u) => {
    try { return new URL(u).hostname.replace(/^www\./, '') } catch { return u }
  }
  const considered = (r) => r.status === 'success' || r.status === 'stale'
  const sevFor = (t) => (t === 'T1' ? 'high' : t === 'T2' ? 'medium' : 'low')

  const gaps = results
    .filter((r) => !r.bybit_present && considered(r))
    .map((r) => ({
      domain: host(r.url),
      path: r.path || '',
      severity: sevFor(r.tier),
      tier: r.tier,
      country: r.geo,
      description: `Bybit absent — ${
        (r.competitors_present || []).slice(0, 3).join(', ') || 'no named competitors'
      }`,
      _opp: r.opp_score,
      unverified: r.status === 'stale',
    }))

  const acc = {}
  results.forEach((r) =>
    (r.competitors_present || []).forEach((c) => {
      acc[c] = acc[c] || { name: c, blocksOnGaps: 0 }
      if (!r.bybit_present && considered(r)) acc[c].blocksOnGaps += 1
    }),
  )
  const maxBlocks = Math.max(1, ...Object.values(acc).map((c) => c.blocksOnGaps))
  const competitors = Object.values(acc)
    .map((c) => ({
      name: c.name,
      blocksOnGaps: c.blocksOnGaps,
      threatScore: Math.round((c.blocksOnGaps / maxBlocks) * 100),
    }))
    .sort((a, b) => b.threatScore - a.threatScore)

  // ── Dashboard wiring — spec-exact real values for the main display.
  // Additive only: ScanResultsPanel keeps reading score/gaps/competitors as
  // before. `dashboard` is null when no rows so the seeded fallback holds.
  const normGeo = (g) => {
    const s = String(g || '').toLowerCase()
    if (s.includes('gb') || s.includes('uk')) return 'UK'
    if (s.includes('de')) return 'DE'
    if (s.includes('europe') || s === 'eu') return 'EU'
    return 'GLOBAL'
  }
  const tierOf = (r) =>
    r.tier ||
    ((r.opp_score ?? 0) >= 40 ? 'T1' : (r.opp_score ?? 0) >= 20 ? 'T2' : 'T3')
  const dTotal = results.length
  const dBybit = results.filter((r) => r.bybit_present).length
  const dEuScore = dTotal ? Math.round((dBybit / dTotal) * 100) : 0
  const dT1Gaps = results.filter(
    (r) => !r.bybit_present && tierOf(r) === 'T1',
  ).length
  const dBrandAlerts = results.filter(
    (r) =>
      !r.bybit_present &&
      (r.competitors_present || []).some((c) => c === 'Revolut'),
  ).length
  const dGapCards = results
    .filter((r) => !r.bybit_present)
    .slice()
    .sort((a, b) => (b.opp_score ?? 0) - (a.opp_score ?? 0))
    .slice(0, 9)
    .map((r) => ({
      url: r.url,
      domain: host(r.url),
      path: r.path || '',
      competitors:
        r.competitors_present && r.competitors_present.length
          ? r.competitors_present
          : ['Unverified'],
      country: normGeo(r.geo),
      tier: tierOf(r),
      _opp: r.opp_score,
    }))
  // Competitor bars: always the canonical 12 (locked order). Live counts from
  // the backend competitorCounts tally overlay onto the canonical set; any
  // competitor absent from the tally shows 0. Zero-count entries are pinned to
  // the bottom; the rest sort by count descending (stable sort → canonical
  // order preserved within ties and within the zero group).
  const CANONICAL_COMPETITORS = [
    'Binance', 'Kraken', 'Coinbase', 'Bitpanda', 'OKX', 'Crypto.com',
    'Revolut', 'KuCoin', 'Bitget', 'WhiteBit', 'MEXC', 'BingX',
  ]
  const competitorCounts =
    payload.competitorCounts && typeof payload.competitorCounts === 'object'
      ? payload.competitorCounts
      : {}
  const dCompetitorBars = CANONICAL_COMPETITORS
    .map((name) => ({ name, count: Number(competitorCounts[name]) || 0 }))
    .sort((a, b) => {
      const az = a.count === 0
      const bz = b.count === 0
      if (az !== bz) return az ? 1 : -1 // zero-count always at the bottom
      return b.count - a.count // otherwise count descending
    })
  const dashboard =
    dTotal > 0
      ? {
          sitesMonitored: dTotal,
          bybitPresent: dBybit,
          tier1Gaps: dT1Gaps,
          brandAlerts: dBrandAlerts,
          euScore: dEuScore,
          gapCards: dGapCards,
          competitorBars: dCompetitorBars,
        }
      : null

  const total = payload.total_tracked || results.length
  const verified =
    payload.verified ?? results.filter(considered).length
  const failed =
    payload.failed ?? results.filter((r) => r.status === 'unverified').length
  const wins =
    payload.wins_this_scan ?? results.filter((r) => r.bybit_present).length
  const threat = payload.threat_score ?? 0

  return {
    score: payload.score ?? Math.max(0, Math.min(100, 100 - threat)),
    sitesMonitored: total,
    sitesChecked: verified,
    tier1Gaps:
      payload.t1_gaps ?? gaps.filter((g) => g.tier === 'T1').length,
    brandAlerts: 0,
    wins,
    coverage: total ? Math.round((verified / total) * 100) : 0,
    scannedAt: payload.scanned_at || new Date().toISOString(),
    gaps,
    competitors,
    dashboard,
    _total: total,
    _verified: verified,
    _failed: failed,
  }
}

// Number-counter primitive — counts 0→target on mount via framer-motion's
// imperative `animate`. `suffix` lets the PRESSURE pill emit "/100" inline.
function Counter({ target, duration = 0.8, suffix = '' }) {
  const mv = useMotionValue(0)
  const rendered = useTransform(mv, v => `${Math.round(v)}${suffix}`)
  useEffect(() => {
    const ctl = animate(mv, target, { duration, ease: 'easeOut' })
    return () => ctl.stop()
  }, [mv, target, duration])
  return <motion.span>{rendered}</motion.span>
}

// Live UTC clock — ticks every 1s. Format "HH:MM:SS UTC".
function LiveClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const hh = String(now.getUTCHours()).padStart(2, '0')
  const mm = String(now.getUTCMinutes()).padStart(2, '0')
  const ss = String(now.getUTCSeconds()).padStart(2, '0')
  return <>{hh}:{mm}:{ss} UTC</>
}

// Format an ISO timestamp to "HH:MM UTC" (last-scan label).
function fmtClockUtc(iso) {
  if (!iso) return 'PENDING'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return 'PENDING'
    const hh = String(d.getUTCHours()).padStart(2, '0')
    const mm = String(d.getUTCMinutes()).padStart(2, '0')
    return `${hh}:${mm} UTC`
  } catch {
    return 'PENDING'
  }
}

// Stat card with progress-bar fill at the bottom + optional delta indicator.
// `pct` is the bar fill 0–100; bar colour derived from the card role.
function StatPill({ label, value, color, barColor, pct, delta, deltaIsGood, animationDelay }) {
  const safePct = Math.max(0, Math.min(100, pct ?? 0))
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut', delay: animationDelay ?? 0 }}
      whileHover={{ borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.04)' }}
      style={{
        flex: 1,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 3,
        cursor: 'default',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: '10px 14px' }}>
        <div style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 10,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          marginBottom: 5,
        }}>
          {label}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: 15,
            fontWeight: 700,
            color,
          }}>
            {value}
          </div>
          {delta != null && delta !== 0 && (
            <span style={{
              fontFamily: "'Geist Mono', monospace",
              fontSize: 10,
              fontWeight: 600,
              color: deltaIsGood ? '#0dbe82' : '#e8703a',
            }}>
              {delta > 0 ? '↑' : '↓'}{Math.abs(delta)}
            </span>
          )}
        </div>
      </div>
      <div style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${safePct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: (animationDelay ?? 0) + 0.2 }}
          style={{ height: '100%', background: barColor }}
        />
      </div>
    </motion.div>
  )
}

export default function App() {
  const [activeSite, setActiveSite] = useState(null)
  const [scanState, setScanState] = useState('idle')
  const [scanData, setScanData] = useState(null)
  const [scanResultsVisible, setScanResultsVisible] = useState(false)
  const scanResultsPanelRef = useRef(null)
  const mainRef = useRef()
  const askBriefRef = useRef(null)
  // Holds the timeout for the T-key mock scan animation so rapid presses
  // don't stack multiple deferred injections.
  const mockScanTimerRef = useRef(null)
  const [sortState, setSortState] = useState(() => {
    try {
      const saved = localStorage.getItem('horizon_sort_state')
      return saved ? JSON.parse(saved) : { gaps_t1: [], gaps_t2: [], wins: [] }
    } catch {
      return { gaps_t1: [], gaps_t2: [], wins: [] }
    }
  })
  const [strategyBanners, setStrategyBanners] = useState({
    gaps_t1: null, gaps_t2: null, wins: null
  })
  const [competitorPanel, setCompetitorPanel] = useState(null)
  const [scopeOpen, setScopeOpen] = useState(false)

  // Horiz0n suite navigation. 'dashboard' = the untouched P1 tree.
  const [view, setView] = useState('dashboard')
  const [statusOpen, setStatusOpen] = useState(true)
  const [historyTab, setHistoryTab] = useState('decisions')
  const [novaOpen, setNovaOpen] = useState(false)
  const dayStatus = useState(() => getDayStatus().overall)[0]
  // Hero stats — verdict label + field pressure for the always-visible header
  // bar that frames the dashboard. Derived from existing helpers; no new state.
  const overallVerdict = useMemo(() => statusVerdict(dayStatus).label, [dayStatus])
  const fieldPressure = useMemo(() => assessCompetitors().pressure, [])
  const [scanProgress, setScanProgress] = useState(null)
  // Increments every time a scan completes so the scroll-to-results effect
  // refires even when scanResultsVisible was already true (back-to-back
  // scans without closing the panel in between).
  const [scanRevealTick, setScanRevealTick] = useState(0)
  const [marketMoves, setMarketMoves] = useState(null)

  // Always land at the top of the page on mount so the hero header is visible,
  // regardless of any prior scroll state left over from a previous scan.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  // On load: pull the latest real scan + market moves for this org so the
  // dashboard shows live crawler data, not seeds.
  useEffect(() => {
    let alive = true
    ;(async () => {
      const orgId = getActiveOrgId()
      if (!orgId) return
      const headers = await authHeaders()
      try {
        const r = await fetch(
          `${BACKEND}/api/scan/latest?org_id=${encodeURIComponent(orgId)}`,
          { headers },
        )
        if (alive && r.ok) {
          const j = await r.json()
          if ((j.results || []).length > 0) {
            setScanData(transformScan(j))
            setScanResultsVisible(true)
          }
        }
      } catch {
        /* first load — no data; StatusBoard surfaces the empty state */
      }
      try {
        const m = await fetch(
          `${BACKEND}/api/market-moves?org_id=${encodeURIComponent(orgId)}&limit=20`,
          { headers },
        )
        if (alive && m.ok) {
          const mj = await m.json()
          setMarketMoves(mj.moves || [])
        }
      } catch {
        /* market moves optional — panel falls back to seeded narrative */
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // S8 — single section-aware INTEL entry point.
  const openIntel = (ctx, intel) => askBriefRef.current?.openWithContext(ctx, intel)

  // Auto-open the Morning Status board once per day (first visit).
  useEffect(() => {
    let viewed = null
    try { viewed = localStorage.getItem(STATUS_VIEWED_KEY) } catch { /* ignore */ }
    if (viewed !== todayKey()) setStatusOpen(true)
  }, [])

  // Mark seen the moment the board is shown so it won't re-pop today.
  useEffect(() => {
    if (!statusOpen) return
    try { localStorage.setItem(STATUS_VIEWED_KEY, todayKey()) } catch { /* ignore */ }
  }, [statusOpen])

  const handleNav = (id, params) => {
    if (id === 'dashboard') {
      setView('dashboard')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (id === 'status') {
      setView('dashboard')
      setStatusOpen(true)
      requestAnimationFrame(() =>
        setTimeout(() => {
          document.getElementById('hz-status')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          })
        }, 60),
      )
      return
    }
    if (id === 'events') {
      setStatusOpen(false)
    }
    if (id === 'history' && params?.tab) {
      setHistoryTab(params.tab)
    }
    setView(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Recognisable hosts streamed during the wait (the trigger endpoint runs
  // the crawl synchronously server-side; this animates progress client-side).
  const SCAN_TICKER = [
    'finder.com', 'uswitch.com', 'thisismoney.co.uk', 'investopedia.com',
    'nerdwallet.com', 'coinmarketcap.com', 'forbes.com', 'cryptoradar.de',
    'kryptoszene.de', 'tradersunion.com', 'cryptonews.com', 'blockworks.co',
  ]

  const runScan = useCallback(async () => {
    if (scanState !== 'idle') return
    const orgId = getActiveOrgId()
    if (!orgId) {
      setScanState('error')
      setScanProgress('No organisation bound to this account.')
      setTimeout(() => { setScanState('idle'); setScanProgress(null) }, 4000)
      return
    }
    // Scroll to top first, then flip the scanState — so the HeroCanvas amber
    // pulse starts exactly when the user is at the top of the page. State
    // only changes inside onComplete; the promise lets the async runScan
    // wait for the scroll to land before continuing.
    await new Promise((resolve) => {
      gsap.to(window, {
        duration: 0.6,
        scrollTo: 0,
        ease: 'power2.inOut',
        onComplete: () => { setScanState('sentry'); resolve() },
      })
    })

    const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) }

    // Pre-scan timestamp so polling knows when fresh results land.
    let prevAt = null
    try {
      const r = await fetch(
        `${BACKEND}/api/scan/latest?org_id=${encodeURIComponent(orgId)}`,
        { headers },
      )
      if (r.ok) prevAt = (await r.json()).scanned_at || null
    } catch { /* first scan — no prior */ }

    let tick = 0
    const ticker = setInterval(() => {
      const host = SCAN_TICKER[tick % SCAN_TICKER.length]
      setScanProgress(`Checking ${host}… ✓`)
      tick += 1
    }, 1100)

    try {
      const tr = await fetch(`${BACKEND}/api/scan/trigger`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ org_id: orgId }),
      })
      if (!tr.ok) throw new Error(`scan trigger failed (${tr.status})`)
      setScanState('mirror')

      // Poll /api/scan/latest every 3s until results are newer than pre-scan.
      let payload = null
      for (let i = 0; i < 40; i += 1) {
        await new Promise((s) => setTimeout(s, 3000))
        try {
          const lr = await fetch(
            `${BACKEND}/api/scan/latest?org_id=${encodeURIComponent(orgId)}`,
            { headers },
          )
          if (!lr.ok) continue
          const j = await lr.json()
          if (j.scanned_at && j.scanned_at !== prevAt && (j.results || []).length) {
            payload = j
            break
          }
        } catch { /* transient — keep polling */ }
      }
      // Fallback: the trigger response is itself the full summary.
      if (!payload) payload = await tr.json().catch(() => null)
      if (!payload || !(payload.results || []).length) {
        throw new Error('scan produced no results')
      }

      clearInterval(ticker)
      const data = transformScan(payload)
      setScanData(data)
      setScanResultsVisible(true)
      setScanRevealTick((t) => t + 1)
      setScanState('complete')
      setScanProgress(
        `Scan complete — ${data.sitesChecked} sites checked, ` +
          `${data.gaps.length} gaps found, ${data.wins} wins confirmed`,
      )
      // (Scroll into the results panel is handled by the
      // scanResultsVisible-watcher effect below — same GSAP target as the
      // mock path so both feel identical.)
      setTimeout(() => { setScanState('idle'); setScanProgress(null) }, 5000)
    } catch (err) {
      clearInterval(ticker)
      console.error('[runScan]', err?.message ?? err)
      setScanState('error')
      setScanProgress(`Scan failed: ${String(err?.message ?? err).slice(0, 80)}`)
      setTimeout(() => { setScanState('idle'); setScanProgress(null) }, 5000)
    }
  }, [scanState])

  // Stats-delta tracker. Holds the previous (gaps, score) snapshot so each
  // pill can surface a one-character delta indicator next to its value. We
  // intentionally update via useEffect (not during render) to avoid
  // mid-render mutation.
  const prevStatsRef = useRef({ gaps: null, score: null })
  // novaPrevRef + lastScanRef power the once-per-event toast triggers
  // (improvement 6). Refs (not state) so flipping them doesn't cause
  // additional renders.
  const novaPrevRef = useRef(false)
  const lastScanCompletionRef = useRef(null)
  const lastHighPressureRef = useRef(false)

  // T-key shortcut: plays the amber HeroCanvas pulse for ~2.2s, then injects
  // a local mock fixture into frontend state. No network call, no polling —
  // purely a UI test harness. The real scan stays gated behind SCAN NOW
  // (sidebar / status board), which calls runScan above.
  //
  // Note: HeroCanvas's amber pulse activates on the in-flight states the
  // real scan emits — 'sentry' / 'mirror' / 'herald'. We use 'sentry' here
  // so the same animation fires (there's no literal 'scanning' state).
  const loadMockScan = useCallback(() => {
    // Cancel any pending mock injection so rapid T-presses don't stack
    // timers and inject twice.
    if (mockScanTimerRef.current) {
      clearTimeout(mockScanTimerRef.current)
      mockScanTimerRef.current = null
    }
    // Scroll to top first. Only when the scroll lands do we flip into the
    // amber scanning state and schedule the deferred mock injection — so
    // the animation timing matches the real runScan path exactly.
    gsap.to(window, {
      duration: 0.6,
      scrollTo: 0,
      ease: 'power2.inOut',
      onComplete: () => {
        setScanState('sentry')
        mockScanTimerRef.current = setTimeout(() => {
          // Seed the prior-scan snapshot ScanResultsPanel reads from
          // localStorage so VS LAST SCAN renders deterministic deltas
          // (+4 score, +1 gap, +2 wins, +1 alert) instead of synthesising
          // them from seedPriorSnapshot.
          try {
            localStorage.setItem(MOCK_SNAPSHOT_KEY, JSON.stringify(MOCK_PREV_SNAPSHOT))
          } catch { /* localStorage unavailable — diff still works in-memory */ }
          const data = transformScan(MOCK_SCAN)
          // transformScan hard-codes brandAlerts to 0 at the top level (the
          // live dashboard reads dashboard.brandAlerts which IS derived). For
          // the VS LAST SCAN alert delta to fire, surface the dashboard
          // count here.
          data.brandAlerts = data.dashboard?.brandAlerts ?? 0
          setScanData(data)
          setScanResultsVisible(true)
          setScanRevealTick((t) => t + 1)
          setScanState('idle')
          mockScanTimerRef.current = null
        }, 2200)
      },
    })
  }, [])

  // T-key shortcut listener. Re-registers when loadMockScan identity changes
  // (stable via useCallback so this effectively runs once).
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key !== 't' && e.key !== 'T') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const ae = document.activeElement
      const tag = ae?.tagName?.toLowerCase()
      // Block when typing into an input/textarea/contenteditable. Body (or
      // null active element) is fine.
      if (tag === 'input' || tag === 'textarea' || ae?.isContentEditable) return
      e.preventDefault()
      loadMockScan()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [loadMockScan])

  // Scroll the user down to the results panel after every completed scan.
  // Keyed on a tick counter (not on scanResultsVisible) so back-to-back scans
  // refire even when the panel was already visible — setScanResultsVisible(true)
  // is a no-op in that case, but bumping the tick is not.
  // 300ms delay lets the panel's enter animation start before we scroll, so
  // the header arrives at the offset already rendered.
  useEffect(() => {
    if (scanRevealTick === 0) return
    const t = setTimeout(() => {
      const el = document.getElementById('scan-results-panel')
      if (!el) return
      gsap.to(window, {
        duration: 0.8,
        scrollTo: { y: '#scan-results-panel', offsetY: 48 },
        ease: 'power2.inOut',
      })
    }, 300)
    return () => clearTimeout(t)
  }, [scanRevealTick])

  const SCAN_LABELS = {
    idle:     '⟳ Scan Now',
    sentry:   '⟳ Running Sentry...',
    mirror:   '⟳ Running Mirror...',
    herald:   '⟳ Running Herald...',
    complete: '✓ Scan complete',
    error:    '⚠ Agent server offline',
  }

  useEffect(() => {
    const els = mainRef.current?.querySelectorAll('.scroll-reveal')
    if (!els?.length) return
    els.forEach((el, i) => {
      gsap.fromTo(el,
        { opacity: 0, y: 56 },
        { opacity: 1, y: 0, duration: 0.75, ease: 'power2.out', delay: i * 0.06,
          scrollTrigger: { trigger: el, start: 'top 88%', once: true } }
      )
    })
    return () => ScrollTrigger.getAll().forEach(t => t.kill())
  }, [])

  useEffect(() => {
    localStorage.setItem('horizon_sort_state', JSON.stringify(sortState))
  }, [sortState])

  // Toast triggers (improvement 6) — sonner-driven notifications.
  // SCAN COMPLETE: fires once per scan completion (debounced via scannedAt ref).
  useEffect(() => {
    if (scanState !== 'complete' || !scanData) return
    const completionKey = scanData.scannedAt || String(Date.now())
    if (lastScanCompletionRef.current === completionKey) return
    lastScanCompletionRef.current = completionKey
    const gaps = scanData.gaps?.length ?? 0
    const wins = scanData.wins ?? 0
    const t = fmtClockUtc(scanData.scannedAt || new Date().toISOString())
    toast.success(`SCAN COMPLETE · ${gaps} gaps · ${wins} wins · ${t}`)
    // Win toasts — fire one per fresh win, capped at 2 to avoid flood.
    const winGaps = (scanData.gaps || []).filter((g) => g._win || g.bybit_present).slice(0, 2)
    winGaps.forEach((g, i) => {
      setTimeout(() => {
        const comp = (g.competitors_present || g.competitors || [])[0] || 'competitor'
        toast.success(`WIN CONFIRMED · ${comp} · ${g.domain}`)
      }, 600 * (i + 1))
    })
  }, [scanState, scanData])

  // High-pressure crossing toast — only fires on the LOW→HIGH transition.
  useEffect(() => {
    const pressureNum = Number(fieldPressure) || 0
    const isHigh = pressureNum >= 70
    if (isHigh && !lastHighPressureRef.current) {
      toast(`HIGH PRESSURE DETECTED · ${overallVerdict || 'MARKET'}`, {
        style: {
          background: '#0f1422',
          color: '#e8703a',
          border: '1px solid rgba(255,255,255,0.1)',
          borderLeft: '2px solid #e8703a',
        },
      })
    }
    lastHighPressureRef.current = isHigh
  }, [fieldPressure, overallVerdict])

  // N0VA-activation toast — fires once per open transition.
  useEffect(() => {
    if (novaOpen && !novaPrevRef.current) {
      toast.error(`N0VA ALERT · ${overallVerdict || 'OPERATIONAL OVERRIDE'} ENGAGED`)
    }
    novaPrevRef.current = novaOpen
  }, [novaOpen, overallVerdict])

  const handleToggle = (sectionId, key) => {
    setSortState(prev => {
      const current = prev[sectionId]
      const updated = current.includes(key)
        ? current.filter(k => k !== key)
        : [...current, key]
      return {...prev, [sectionId]: updated}
    })
  }

  const handleReset = (sectionId) => {
    setSortState(prev => ({...prev, [sectionId]: []}))
  }

  const handleApplyStrategy = (sectionId, criteria) => {
    setSortState(prev => ({...prev, [sectionId]: criteria}))
    setStrategyBanners(prev => ({...prev, [sectionId]: null}))
  }

  const handleSortStrategy = ({ section, criteria }) => {
    const criteriaArray = criteria.split(',').map(s => s.trim())
    const label = criteriaArray.map(k => CRITERIA[k]?.label || k).join(' → ')
    setStrategyBanners(prev => ({...prev, [section]: { criteria: criteriaArray, label }}))
  }

  const handleOpenPanel = (threatData) => {
    setCompetitorPanel(threatData)
  }

  const handleAskIntel = (question) => {
    setCompetitorPanel(null)
    askBriefRef.current?.openWithQuestion(question)
  }

  // Real scan data drives the main display when present; seeded staticData is
  // the fallback (only overridden when scan_results.length > 0 — see transformScan).
  const dash = scanData?.dashboard || null
  const t1Source = dash?.gapCards ?? GAPS_T1
  const sortedGapsT1 = sortState.gaps_t1.length > 0
    ? sortItems(t1Source, sortState.gaps_t1)
    : dash
      ? t1Source // real gaps already sorted by opp_score DESC (top 9)
      : [...GAPS_T1].sort((a,b) => (b.competitors||[]).length - (a.competitors||[]).length)
  const sortedGapsT2 = sortState.gaps_t2.length > 0
    ? sortItems(GAPS_T2, sortState.gaps_t2)
    : [...GAPS_T2].sort((a,b) => (a.competitors||[]).length - (b.competitors||[]).length)
  const sortedWins = sortState.wins.length > 0
    ? sortItems(WINS, sortState.wins)
    : [...WINS].sort((a,b) => new Date(b.last_scanned||0) - new Date(a.last_scanned||0))

  // Update prev-stats ref after each render so the next render's delta is
  // calculated against the value the user is seeing now. Must be declared
  // AFTER `t1Source` and `dash` (line 749–750) because those are referenced
  // in the dep array — declaring the effect earlier would put the deps in
  // the TDZ and crash with "Cannot access 't1Source' before initialization".
  useEffect(() => {
    const t1Count = Number(t1Source?.length) || 0
    const euScore = Number(dash?.euScore ?? scanData?.score ?? 0)
    prevStatsRef.current = { gaps: t1Count, score: euScore }
  }, [t1Source, dash, scanData])

  return (
    <>
      {/* Fixed top bar — 44px persistent status line visible on every page.
          Content (left→right): LIVE · LAST SCAN · GAPS · LATENCY · live clock.
          AccountMenu sits to the far right. */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 'var(--hz-sidebar)',
          right: 0,
          height: 44,
          zIndex: 200,
          background: 'rgba(0, 0, 0, 0.2)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          padding: '0 24px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            fontFamily: "'Geist Mono', monospace",
            fontSize: 10,
            letterSpacing: '0.06em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          {(() => {
            const gapsCount = Number(t1Source?.length) || 0
            const lastScanIso = scanData?.scannedAt || null
            const sep = (
              <span style={{ color: 'var(--text-muted)', margin: '0 8px' }}>·</span>
            )
            return (
              <>
                <Circle
                  size={7}
                  fill="#0dbe82"
                  strokeWidth={0}
                  style={{ color: '#0dbe82', animation: 'livePulse 2s ease-in-out infinite', flexShrink: 0, marginRight: 6 }}
                />
                <span style={{ color: '#0dbe82', fontWeight: 600 }}>LIVE</span>
                {sep}
                <span style={{ color: '#8892a4' }}>
                  LAST SCAN: <span style={{ color: lastScanIso ? '#b8c4d4' : '#8892a4' }}>{fmtClockUtc(lastScanIso)}</span>
                </span>
                {sep}
                <span style={{ color: gapsCount > 0 ? '#e8703a' : '#8892a4', fontWeight: 600 }}>
                  {gapsCount} GAPS
                </span>
                {sep}
                <span style={{ color: '#8892a4' }}>
                  LATENCY: <span style={{ color: '#b8c4d4' }}>12ms</span>
                </span>
                {sep}
                <span style={{ color: '#b8c4d4', fontVariantNumeric: 'tabular-nums' }}>
                  <LiveClock />
                </span>
              </>
            )
          })()}
        </div>
        <AccountMenu />
      </div>

      <HorizonSidebar
        view={view}
        onNav={handleNav}
        onNova={() => setNovaOpen(true)}
        onTrace={() => setScopeOpen(true)}
        onIntel={() =>
          openIntel(
            'You are the C0insiglieri operations assistant. The operator opened you from the sidebar — answer across the full intelligence suite (status, windows, outcomes, ledger, signal, brief, network).',
          )
        }
        onScan={runScan}
        scanState={scanState}
        compactStatus={statusOpen ? null : dayStatus}
      />

      {view === 'dashboard' ? (
      <div className="hz-shell">
      {/* HERO — full-viewport radar background with overlay copy top-left
          and a bouncing scroll indicator at bottom-center.
          The HeroCanvas <section> is natively width:100% / height:100vh, so
          it fills this wrapper without any sizing CSS from our side.
          pointer-events:none on the overlay keeps blip hover targets clickable. */}
      <section
        id="hz-hero"
        style={{
          position: 'relative',
          width: '100%',
          height: '100vh',
        }}
      >
        {/* Radar — always visible, fills the hero. No wrapper, no scale,
            no condition. Internal logic, mouse interactivity, animations,
            dot colours, sweeps, and the centre data cards all untouched. */}
        <HeroCanvas
          scanState={scanState}
          targetScore={dash?.euScore}
          metrics={
            dash && {
              sitesMonitored: dash.sitesMonitored,
              bybitPresent: dash.bybitPresent,
              tier1Gaps: dash.tier1Gaps,
              brandAlerts: dash.brandAlerts,
            }
          }
        />

        {/* Hero copy — absolute top-left, padded 32px, sitting above the radar.
            76px top-padding = 44px topbar clearance + spec-mandated 32px. */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            padding: '76px 32px 32px 32px',
            zIndex: 10,
            pointerEvents: 'none',
            fontWeight: 800,
            color: '#ffffff',
            lineHeight: 1.0,
            letterSpacing: '-0.03em',
            textTransform: 'uppercase',
            fontFamily: "'Geist', sans-serif",
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{ fontSize: 72 }}
          >
            Market intelligence.
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            style={{ fontSize: 72 }}
          >
            <span
              style={{
                color: '#0dbe82',
                filter: 'drop-shadow(0 0 24px rgba(13,190,130,0.55))',
                textShadow: '0 0 28px rgba(13,190,130,0.6)',
              }}
            >
              0{' '}
            </span>
            <span style={{ color: '#ffffff' }}>guess.</span>
          </motion.div>
        </div>

        {/* Scroll indicator — bottom-center, gentle bounce, scrolls to stats. */}
        <button
          onClick={() => {
            document.getElementById('hz-stats')?.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            })
          }}
          aria-label="Scroll to status"
          style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            zIndex: 10,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 6,
            color: 'var(--text-muted)',
            animation: 'scrollBounce 2s ease-in-out infinite',
          }}
        >
          <ChevronDown size={22} strokeWidth={1.75} />
        </button>
      </section>

      {/* Stats bar — 4 cards (FIELD / T1 GAPS / WINDOW / EU SCORE) each with
          a bottom progress bar + delta indicator. PRESSURE replaced by EU
          SCORE per the v3 layout spec; FIELD bar derives from pressure level. */}
      {(() => {
        const pressureNum = Number(fieldPressure) || 0
        const t1Count = Number(t1Source.length) || 0
        const euScore = Number(dash?.euScore ?? scanData?.score ?? 0)
        const pressureLevel = pressureNum >= 70 ? 'HIGH' : pressureNum >= 40 ? 'MEDIUM' : 'LOW'
        const pressurePct = pressureLevel === 'HIGH' ? 85 : pressureLevel === 'MEDIUM' ? 50 : 20
        const gapsPct = Math.min(100, (t1Count / 20) * 100)
        const windowPct = (14 / 30) * 100
        const prev = prevStatsRef.current
        const gapsDelta = prev.gaps != null ? t1Count - prev.gaps : null
        const scoreDelta = prev.score != null ? euScore - prev.score : null
        return (
          <div
            id="hz-stats"
            style={{
              padding: '32px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <StatPill
                label="FIELD"
                value={overallVerdict || 'MONITORING'}
                color="#e8703a"
                barColor="#e8703a"
                pct={pressurePct}
                animationDelay={0.15}
              />
              <StatPill
                label="T1 GAPS"
                value={<Counter target={t1Count} duration={0.6} />}
                color="#e8703a"
                barColor="#e8703a"
                pct={gapsPct}
                delta={gapsDelta}
                deltaIsGood={gapsDelta != null && gapsDelta < 0}
                animationDelay={0.23}
              />
              <StatPill
                label="WINDOW"
                value="14 DAYS"
                color="#18b4d4"
                barColor="#18b4d4"
                pct={windowPct}
                animationDelay={0.31}
              />
              <StatPill
                label="EU SCORE"
                value={<><Counter target={euScore} duration={0.8} /><span style={{ color: '#8892a4', fontSize: 11, marginLeft: 2 }}>%</span></>}
                color="#0dbe82"
                barColor="#0dbe82"
                pct={euScore}
                delta={scoreDelta}
                deltaIsGood={scoreDelta != null && scoreDelta > 0}
                animationDelay={0.39}
              />
            </div>
          </div>
        )
      })()}
      <main ref={mainRef} style={{ background: 'var(--bg-primary)', paddingTop: 0 }}>

        {statusOpen && (
          <div id="hz-status" className="container" style={{ paddingTop: 0 }}>
            <StatusBoard
              onDismiss={() => setStatusOpen(false)}
              onAskIntel={openIntel}
              onAskQuestion={handleAskIntel}
              onNav={handleNav}
              onScan={runScan}
              scanState={scanState}
              scanData={scanData}
              hasScanData={!!dash}
              liveCompetitors={dash?.competitorBars}
              liveCoverage={
                dash && {
                  present: dash.bybitPresent,
                  tracked: dash.sitesMonitored,
                  pct: dash.euScore,
                }
              }
              onOpenCompetitorPanel={handleOpenPanel}
            />
          </div>
        )}

        <ScanResultsPanel
          ref={scanResultsPanelRef}
          visible={scanResultsVisible}
          scanData={scanData}
          marketMoves={marketMoves}
          onClose={() => setScanResultsVisible(false)}
          onDraftOutreach={(q) => askBriefRef.current?.openWithQuestion(q)}
          onAskIntel={openIntel}
        />

{/* Priority Gaps T1 — 3-column grid */}
        <section className="scroll-reveal" style={{ padding: '48px 0' }}>
          <div className="container">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 16, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--t1)' }}>Priority Gaps — Tier 1</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '1px 8px', borderRadius: 99, background: 'var(--t1-dim)', color: 'var(--t1)', border: '1px solid rgba(148,200,100,.3)' }}>{t1Source.length}</span>
            </div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>Sites where Tier 1 competitors are listed and Bybit is absent</p>
            <SortBar sectionId="gaps_t1" activeCriteria={sortState.gaps_t1} onToggle={(key) => handleToggle('gaps_t1', key)} onReset={() => handleReset('gaps_t1')} strategyBanner={strategyBanners.gaps_t1} onApplyStrategy={(c) => handleApplyStrategy('gaps_t1', c)} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
              {sortedGapsT1.map(g => (
                <GapCard key={g.url} gap={{ ...g, tier: 'T1' }} onDraftOutreach={setActiveSite} />
              ))}
            </div>
          </div>
        </section>

        {/* Tier 2 Opportunities — 3-column grid */}
        <section style={{ padding: '0 0 48px' }}>
          <div className="container">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 16, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--amber)' }}>Tier 2 Opportunities</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '1px 8px', borderRadius: 99, background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid rgba(212,168,83,.3)' }}>{GAPS_T2.length}</span>
            </div>
            <SortBar sectionId="gaps_t2" activeCriteria={sortState.gaps_t2} onToggle={(key) => handleToggle('gaps_t2', key)} onReset={() => handleReset('gaps_t2')} strategyBanner={strategyBanners.gaps_t2} onApplyStrategy={(c) => handleApplyStrategy('gaps_t2', c)} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, alignItems: 'stretch' }}>
              {sortedGapsT2.map(g => (
                <GapCard key={g.url} gap={{ ...g, tier: 'T2' }} onDraftOutreach={setActiveSite} />
              ))}
            </div>
          </div>
        </section>

        {/* Confirmed Wins — 3-column grid */}
        <section className="scroll-reveal" style={{ padding: '0 0 24px' }}>
          <div className="container">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span className="pulse-dot" style={{ background: 'var(--green)', boxShadow: '0 0 8px rgba(0,229,160,.7)' }} />
              <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 16, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--green)' }}>Confirmed Wins</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '1px 8px', borderRadius: 99, background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(0,229,160,.3)' }}>{WINS.length}</span>
            </div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)', marginBottom: 16 }}>Pages where Bybit is currently featured</p>
            <SortBar sectionId="wins" activeCriteria={sortState.wins} onToggle={(key) => handleToggle('wins', key)} onReset={() => handleReset('wins')} strategyBanner={strategyBanners.wins} onApplyStrategy={(c) => handleApplyStrategy('wins', c)} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, alignItems: 'start' }}>
              {sortedWins.map(w => <WinCard key={w.url} win={w} />)}
            </div>
          </div>
        </section>

        <footer style={{ borderTop: '1px solid var(--border)', padding: '28px 0', minHeight: 76 }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 16 }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 300, color: 'var(--text-muted)' }}>C<span style={{ color: '#5BA8B5' }}>0</span>insiglieri</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--cyan)' }}>{dash?.euScore ?? SCORE}% EU Presence</span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 300, color: 'var(--text-muted)', textAlign: 'right' }}>Project Horiz<span style={{ color: '#0dbe82' }}>0</span>n v4 · Sentry · Mirror · Herald</span>
            </div>
          </div>
        </footer>

      </main>
      </div>
      ) : (
      <div className="hz-shell">
        <HorizonView
          view={view}
          onNav={handleNav}
          onAskIntel={openIntel}
          historyTab={historyTab}
          orgId={getActiveOrgId()}
        />
      </div>
      )}

      {view === 'dashboard' && (
      <>
      {activeSite && <OutreachPanel site={activeSite} onClose={() => setActiveSite(null)} />}
      {competitorPanel && (
        <CompetitorPanel
          competitor={competitorPanel}
          onClose={() => setCompetitorPanel(null)}
          onAskIntel={handleAskIntel}
        />
      )}
      </>
      )}

      {/* Global panels — reachable from every view (S4/S8) */}
      <ScopePanel
        open={scopeOpen}
        onClose={() => setScopeOpen(false)}
        onAskIntel={openIntel}
      />
      <AskTheBrief ref={askBriefRef} onSortStrategy={handleSortStrategy} />

      {novaOpen && <Nova onExit={() => setNovaOpen(false)} onAskIntel={openIntel} />}

      <Toaster
        position="bottom-right"
        theme="dark"
        duration={4000}
        visibleToasts={3}
        toastOptions={{
          style: {
            background: '#0f1422',
            color: '#b8c4d4',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 3,
            fontFamily: "'Geist Mono', monospace",
            fontSize: 11,
            letterSpacing: '0.04em',
          },
          classNames: {
            success: 'gsd-toast-success',
            error:   'gsd-toast-error',
            default: 'gsd-toast-default',
          },
        }}
      />

      {scanProgress && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2000,
            background: '#0f1422',
            border: `1px solid ${
              scanState === 'error'
                ? 'rgba(255,77,109,0.4)'
                : scanState === 'complete'
                ? 'rgba(13,190,130,0.4)'
                : 'rgba(24,180,212,0.35)'
            }`,
            borderRadius: 3,
            padding: '12px 22px',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color:
              scanState === 'error'
                ? '#ff4d6d'
                : scanState === 'complete'
                ? '#0dbe82'
                : '#18b4d4',
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            maxWidth: '90vw',
          }}
        >
          {scanProgress}
        </div>
      )}
    </>
  )
}
