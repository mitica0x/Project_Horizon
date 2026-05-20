import { useState, useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
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
  const [historyTab, setHistoryTab] = useState('decisions')
  const [novaOpen, setNovaOpen] = useState(false)
  const dayStatus = useState(() => getDayStatus().overall)[0]
  const [scanProgress, setScanProgress] = useState(null)
  const [marketMoves, setMarketMoves] = useState(null)

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
      {/* Fixed top bar — tracks the sidebar's right edge via
          left:var(--hz-sidebar) (210 expanded / 52 collapsed) to right:0, so
          it never overlaps the sidebar. Frosted semi-transparent dark + blur,
          LIVE + account right-aligned. Both content roots pad 48 to clear it. */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 'var(--hz-sidebar)',
          right: 0,
          height: 48,
          zIndex: 200,
          background: 'rgba(10, 14, 26, 0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 14,
          padding: '0 24px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#94c864',
              animation: 'livePulse 2s ease-in-out infinite',
            }}
          />
          <span
            style={{
              fontFamily: "'Geist Mono', monospace",
              fontSize: 10,
              color: '#94c864',
              letterSpacing: '0.15em',
            }}
          >
            LIVE
          </span>
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

        {statusOpen && (
          <div id="hz-status" className="container" style={{ paddingTop: 24 }}>
            <StatusBoard
              onDismiss={() => setStatusOpen(false)}
              onAskIntel={openIntel}
              onAskQuestion={handleAskIntel}
              onNav={handleNav}
              onScan={runScan}
              scanState={scanState}
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
