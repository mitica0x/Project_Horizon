import { useState, useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import HeroCanvas from './components/HeroCanvas'
import ScanResultsPanel from './components/ScanResultsPanel'
import GapCard from './components/GapCard'
import WinCard from './components/WinCard'
import CompetitorChart from './components/CompetitorChart'
import SiteTable from './components/SiteTable'
import OutreachPanel from './components/OutreachPanel'
import AskTheBrief from './components/AskTheBrief'
import ScopePanel from './components/ScopePanel'
import { GAPS_T1, GAPS_T2, WINS, SCORE, PAGES_PRESENT, PAGES_TRACKED, TABLE_DATA as SITE_TABLE_DATA, COMPETITORS } from './data/staticData'
import { sortItems, CRITERIA } from './utils/sortEngine'
import SortBar from './components/SortBar'
import CompetitorPanel from './components/CompetitorPanel'
import CustomCompetitors from './components/CustomCompetitors'
import AccountMenu from './components/AccountMenu'
import { computeThreatScore } from './utils/threatScore'
import HorizonSidebar from './components/HorizonSidebar'
import StatusBoard from './components/StatusBoard'
import HorizonView from './components/HorizonView'
import Nova from './components/Nova'
import { getDayStatus } from './utils/horizonData'
import { supabase, getActiveOrgId } from './lib/supabase'

gsap.registerPlugin(ScrollTrigger)

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
  // Competitor bars come from the backend competitorCounts tally. Empty or
  // absent → []; CompetitorChart then keeps its seeded fallback.
  const dCompetitorBars =
    payload.competitorCounts && typeof payload.competitorCounts === 'object'
      ? Object.entries(payload.competitorCounts)
          .filter(([, n]) => n > 0)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
      : []
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

// DEV mock used by the T-key fake scan and as a fallback if /api/dashboard
// is missing on the backend. Mirrors the hero stat-card numbers (52 / 25 / 9 / 1)
// so the panel demos against familiar values.
const MOCK_SCAN_DATA = {
  score: 52, scoreDelta: 4,
  sitesMonitored: 25, sitesChecked: 25,
  tier1Gaps: 9, tier1GapsDelta: -2,
  brandAlerts: 1, alertsDelta: 0,
  wins: 13, winsDelta: 1,
  coverage: 52,
  scannedAt: new Date().toISOString(),
  gaps: [
    { domain: 'finder.com',         path: '/uk/crypto/exchanges',   severity: 'high',   description: 'Bybit absent — Revolut + Crypto.com listed', tier: 'T1', country: '🇬🇧 UK' },
    { domain: 'cryptoradar.de',     path: '/best-exchanges',        severity: 'high',   description: 'Bybit absent — Bitpanda Tier 1',             tier: 'T1', country: '🇩🇪 DE' },
    { domain: 'investopedia.com',   path: '/best-crypto-exchanges', severity: 'high',   description: 'Bybit absent — Coinbase first',              tier: 'T1', country: '🌍 Global' },
    { domain: 'cointelegraph.com',  path: '/exchanges',             severity: 'medium', description: 'Bybit absent — Binance + Kraken',            tier: 'T2', country: '🌍 Global' },
    { domain: 'coingecko.com',      path: '/exchanges/europe',      severity: 'medium', description: 'Bybit absent — KuCoin + OKX',               tier: 'T2', country: '🇪🇺 EU' },
    { domain: 'cryptocompare.com',  path: '/exchanges',             severity: 'medium', description: 'Bybit absent — Bitget + WhiteBit',           tier: 'T2', country: '🌍 Global' },
    { domain: 'forbes.com',         path: '/advisor/investing',     severity: 'low',    description: 'Bybit absent — MEXC mentioned',               tier: 'T2', country: '🌍 Global' },
    { domain: 'bankrate.com',       path: '/crypto/exchanges',      severity: 'low',    description: 'Bybit absent — Coinbase listed',             tier: 'T2', country: '🇺🇸 US' },
    { domain: 'nerdwallet.com',     path: '/best/banking/crypto',   severity: 'low',    description: 'Bybit absent — Crypto.com primary',          tier: 'T2', country: '🇺🇸 US' },
  ],
  competitors: [
    { name: 'Revolut',     threatScore: 87, blocksOnGaps: 6 },
    { name: 'Crypto.com',  threatScore: 74, blocksOnGaps: 5 },
    { name: 'Binance',     threatScore: 68, blocksOnGaps: 4 },
    { name: 'Bitpanda',    threatScore: 52, blocksOnGaps: 3 },
    { name: 'Kraken',      threatScore: 41, blocksOnGaps: 2 },
  ],
}

export default function App() {
  const [activeSite, setActiveSite] = useState(null)
  const [scanState, setScanState] = useState('idle')
  const [scanData, setScanData] = useState(null)
  const [scanResultsVisible, setScanResultsVisible] = useState(false)
  const scanResultsPanelRef = useRef(null)
  const mainRef = useRef()
  const askBriefRef = useRef(null)
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
  const [statusOpen, setStatusOpen] = useState(false)
  const [novaOpen, setNovaOpen] = useState(false)
  const dayStatus = useState(() => getDayStatus().overall)[0]
  const [scanProgress, setScanProgress] = useState(null)
  const [marketMoves, setMarketMoves] = useState(null)
  const [scanEmpty, setScanEmpty] = useState(false)

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
          } else {
            setScanEmpty(true)
          }
        } else if (alive) {
          setScanEmpty(true)
        }
      } catch {
        if (alive) setScanEmpty(true)
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
  const onScanFromNav = () => {
    setView('dashboard')
    requestAnimationFrame(() => runScan())
  }

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

  const handleNav = (id) => {
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

  async function runScan() {
    if (scanState !== 'idle') return
    const orgId = getActiveOrgId()
    if (!orgId) {
      setScanState('error')
      setScanProgress('No organisation bound to this account.')
      setTimeout(() => { setScanState('idle'); setScanProgress(null) }, 4000)
      return
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
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

    setScanState('sentry')
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
      setScanEmpty(false)
      setScanResultsVisible(true)
      setScanState('complete')
      setScanProgress(
        `Scan complete — ${data.sitesChecked} sites checked, ` +
          `${data.gaps.length} gaps found, ${data.wins} wins confirmed`,
      )
      setTimeout(() => window.scrollBy({ top: 400, behavior: 'smooth' }), 600)
      setTimeout(() => { setScanState('idle'); setScanProgress(null) }, 5000)
    } catch (err) {
      clearInterval(ticker)
      console.error('[runScan]', err?.message ?? err)
      setScanState('error')
      setScanProgress(`Scan failed: ${String(err?.message ?? err).slice(0, 80)}`)
      setTimeout(() => { setScanState('idle'); setScanProgress(null) }, 5000)
    }
  }

  // DEV ONLY — press 'T' anywhere (not in an input) to trigger a fake scan cycle.
  // 0s → 'sentry' (active scan visuals), +3s → 'complete' (blue flash + count-up),
  // +5s → 'idle'. Lets us preview the radar effects without hitting backend/Airtable.
  // Remove this block before production.
  useEffect(() => {
    function onKey(e) {
      if (e.key !== 't' && e.key !== 'T') return
      const t = e.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (scanState !== 'idle') return
      console.log('[DEV] T pressed — fake scan cycle')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      setScanState('sentry')
      setTimeout(() => {
        setScanData({ ...MOCK_SCAN_DATA, scannedAt: new Date().toISOString() })
        setScanResultsVisible(true)
        setScanState('complete')
        setTimeout(() => {
          window.scrollBy({ top: 400, behavior: 'smooth' })
        }, 600)
      }, 3000)
      setTimeout(() => setScanState('idle'), 5000)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [scanState])

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
  const t1Left  = sortedGapsT1.slice(0, 5)
  const t1Right = sortedGapsT1.slice(5)
  const half     = Math.ceil(sortedWins.length / 2)
  const winsLeft  = sortedWins.slice(0, half)
  const winsRight = sortedWins.slice(half)

  return (
    <>
      {/* Fixed top header bar */}
      <header style={{
        position:             'fixed',
        top:                  0,
        left:                 0,
        width:                '100%',
        height:               48,
        zIndex:               200,
        background:           'rgba(10,14,26,0.85)',
        backdropFilter:       'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom:         '1px solid rgba(0,212,232,0.15)',
        display:              'flex',
        alignItems:           'center',
        justifyContent:       'space-between',
        padding:              '0 32px',
        boxSizing:            'border-box',
      }}>
        <div style={{
          fontFamily:    "'Geist', sans-serif",
          fontSize:      12,
          fontWeight:    700,
          letterSpacing: '0.2em',
          color:         '#94c864',
        }}>
          PROJECT HORIZON
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              display:      'inline-block',
              width:        6,
              height:       6,
              borderRadius: '50%',
              background:   '#94c864',
              animation:    'livePulse 2s ease-in-out infinite',
            }} />
            <span style={{
              fontFamily:    "'Geist Mono', monospace",
              fontSize:      10,
              color:         '#94c864',
              letterSpacing: '0.15em',
            }}>
              LIVE
            </span>
          </div>
          <div style={{
            fontFamily: "'Geist', sans-serif",
            fontSize:   11,
            color:      '#8892a4',
          }}>
            C<span style={{ color: '#5BA8B5' }}>0</span>insiglieri
          </div>
          <AccountMenu />
        </div>
        <style>{`
          @keyframes livePulse {
            0%, 100% { transform: scale(1);   opacity: 1;   }
            50%      { transform: scale(1.4); opacity: 0.4; }
          }
        `}</style>
      </header>

      <HorizonSidebar
        view={view}
        onNav={handleNav}
        onNova={() => setNovaOpen(true)}
        onTrace={() => setScopeOpen(true)}
        onIntel={() =>
          openIntel(
            'You are the Horiz0n operations assistant. The operator opened you from the sidebar — answer across the full intelligence suite (status, windows, outcomes, ledger, signal, brief, network).',
          )
        }
        onScan={onScanFromNav}
        scanState={scanState}
        compactStatus={statusOpen ? null : dayStatus}
      />

      {view === 'dashboard' ? (
      <div className="hz-shell">
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
      <ScanResultsPanel
        ref={scanResultsPanelRef}
        visible={scanResultsVisible}
        scanData={scanData}
        marketMoves={marketMoves}
        onClose={() => setScanResultsVisible(false)}
        onDraftOutreach={(q) => askBriefRef.current?.openWithQuestion(q)}
        onAskIntel={openIntel}
      />
      <main ref={mainRef} style={{ background: 'var(--bg-primary)', paddingTop: 48 }}>

        {scanEmpty && !scanResultsVisible && (
          <div className="container" style={{ paddingTop: 24 }}>
            <div
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '28px 30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 18, color: 'var(--white)' }}>
                  No scan data yet
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                  Run the first crawl to populate live presence, gaps and competitor data.
                </div>
              </div>
              <button
                onClick={runScan}
                disabled={scanState !== 'idle'}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  letterSpacing: '0.06em',
                  color: scanState === 'idle' ? '#94c864' : 'var(--text-muted)',
                  background: '#131929',
                  border: '1px solid rgba(148,200,100,0.4)',
                  borderRadius: 6,
                  padding: '12px 22px',
                  cursor: scanState === 'idle' ? 'pointer' : 'default',
                }}
              >
                ⟳ Run first scan
              </button>
            </div>
          </div>
        )}

        {statusOpen && (
          <div id="hz-status" className="container" style={{ paddingTop: 24 }}>
            <StatusBoard onDismiss={() => setStatusOpen(false)} onAskIntel={openIntel} onNav={handleNav} />
          </div>
        )}

{/* Priority Gaps T1 — 2-column grid */}
        <section className="scroll-reveal" style={{ padding: '48px 0' }}>
          <div className="container">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 16, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--t1)' }}>Priority Gaps — Tier 1</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '1px 8px', borderRadius: 99, background: 'var(--t1-dim)', color: 'var(--t1)', border: '1px solid rgba(148,200,100,.3)' }}>{t1Source.length}</span>
            </div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>Sites where Tier 1 competitors are listed and Bybit is absent</p>
            <SortBar sectionId="gaps_t1" activeCriteria={sortState.gaps_t1} onToggle={(key) => handleToggle('gaps_t1', key)} onReset={() => handleReset('gaps_t1')} strategyBanner={strategyBanners.gaps_t1} onApplyStrategy={(c) => handleApplyStrategy('gaps_t1', c)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>{t1Left.map(g => <GapCard key={g.url} gap={{ ...g, tier: 'T1' }} onDraftOutreach={setActiveSite} />)}</div>
              <div>{t1Right.map(g => <GapCard key={g.url} gap={{ ...g, tier: 'T1' }} onDraftOutreach={setActiveSite} />)}</div>
            </div>
          </div>
        </section>

        {/* Competitor Presence — full width */}
        <section className="scroll-reveal" style={{ padding: '0 0 48px' }}>
          <div className="container">
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '24px 28px' }}>
              <CustomCompetitors />
              <CompetitorChart
                competitors={COMPETITORS}
                siteData={SITE_TABLE_DATA}
                gapsT1={GAPS_T1}
                gapsT2={GAPS_T2}
                liveCompetitors={dash?.competitorBars}
                liveCoverage={
                  dash && {
                    present: dash.bybitPresent,
                    tracked: dash.sitesMonitored,
                    pct: dash.euScore,
                  }
                }
                onOpenPanel={handleOpenPanel}
              />
            </div>
          </div>
        </section>

        {/* Tier 2 Opportunities — horizontal row */}
        <section style={{ padding: '0 0 48px' }}>
          <div className="container">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 16, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--amber)' }}>Tier 2 Opportunities</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '1px 8px', borderRadius: 99, background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid rgba(212,168,83,.3)' }}>{GAPS_T2.length}</span>
            </div>
            <SortBar sectionId="gaps_t2" activeCriteria={sortState.gaps_t2} onToggle={(key) => handleToggle('gaps_t2', key)} onReset={() => handleReset('gaps_t2')} strategyBanner={strategyBanners.gaps_t2} onApplyStrategy={(c) => handleApplyStrategy('gaps_t2', c)} />
            <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 20, alignItems: 'stretch' }}>
              {sortedGapsT2.map(g => (
                <div key={g.url} style={{ flex: 1, minWidth: 0, display: 'grid' }}>
                  <GapCard gap={{ ...g, tier: 'T2' }} onDraftOutreach={setActiveSite} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Confirmed Wins — 2-column grid */}
        <section className="scroll-reveal" style={{ padding: '0 0 24px' }}>
          <div className="container">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span className="pulse-dot" style={{ background: 'var(--green)', boxShadow: '0 0 8px rgba(0,229,160,.7)' }} />
              <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 16, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--green)' }}>Confirmed Wins</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '1px 8px', borderRadius: 99, background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(0,229,160,.3)' }}>{WINS.length}</span>
            </div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)', marginBottom: 16 }}>Pages where Bybit is currently featured</p>
            <SortBar sectionId="wins" activeCriteria={sortState.wins} onToggle={(key) => handleToggle('wins', key)} onReset={() => handleReset('wins')} strategyBanner={strategyBanners.wins} onApplyStrategy={(c) => handleApplyStrategy('wins', c)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
              <div>{winsLeft.map(w => <WinCard key={w.url} win={w} />)}</div>
              <div>{winsRight.map(w => <WinCard key={w.url} win={w} />)}</div>
            </div>
          </div>
        </section>

        {/* Tracked URLs Table — full width */}
        <section className="scroll-reveal" style={{ padding: '0 0 48px' }}>
          <div className="container">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 16, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-body)' }}>All Tracked URLs</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '1px 8px', borderRadius: 99, background: 'rgba(255,255,255,.05)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{PAGES_TRACKED}</span>
            </div>
            <SiteTable openWithQuestion={handleAskIntel} />
          </div>
        </section>

        <footer style={{ borderTop: '1px solid var(--border)', padding: '28px 0', minHeight: 76 }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 16 }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 300, color: 'var(--text-muted)' }}>C<span style={{ color: '#5BA8B5' }}>0</span>insiglieri</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--cyan)' }}>{dash?.euScore ?? SCORE}% EU Presence</span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 300, color: 'var(--text-muted)', textAlign: 'right' }}>Project Horiz<span style={{ color: '#94c864' }}>0</span>n v4 · Sentry · Mirror · Herald</span>
            </div>
          </div>
        </footer>

      </main>
      </div>
      ) : (
      <div className="hz-shell">
        <HorizonView view={view} onNav={handleNav} onAskIntel={openIntel} />
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

      {scanProgress && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2000,
            background: '#131929',
            border: `1px solid ${
              scanState === 'error'
                ? 'rgba(255,77,109,0.4)'
                : scanState === 'complete'
                ? 'rgba(148,200,100,0.4)'
                : 'rgba(0,212,232,0.35)'
            }`,
            borderRadius: 8,
            padding: '12px 22px',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color:
              scanState === 'error'
                ? '#ff4d6d'
                : scanState === 'complete'
                ? '#94c864'
                : '#00d4e8',
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
