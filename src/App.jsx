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
import { computeThreatScore } from './utils/threatScore'

gsap.registerPlugin(ScrollTrigger)

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
    { domain: 'coingecko.com',      path: '/exchanges/europe',      severity: 'medium', description: 'Bybit absent — Bitvavo + OKX',               tier: 'T2', country: '🇪🇺 EU' },
    { domain: 'cryptocompare.com',  path: '/exchanges',             severity: 'medium', description: 'Bybit absent — Bitget + Bitstamp',           tier: 'T2', country: '🌍 Global' },
    { domain: 'forbes.com',         path: '/advisor/investing',     severity: 'low',    description: 'Bybit absent — N26 mentioned',               tier: 'T2', country: '🌍 Global' },
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

  async function runScan() {
    if (scanState !== 'idle') return
    console.log('[runScan] start')
    // Make sure the radar hero is in view so the scan-state visuals are visible
    window.scrollTo({ top: 0, behavior: 'smooth' })
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'
      for (const agent of ['sentry', 'mirror', 'herald']) {
        console.log(`[runScan] setScanState('${agent}')`)
        setScanState(agent)
        const res = await fetch(`${backendUrl}/run/${agent}`, { method: 'POST' })
        if (!res.ok) throw new Error(`${agent} failed`)
      }
      console.log("[runScan] setScanState('complete')")
      setScanState('complete')
      // Fetch live dashboard for the post-scan results panel.
      // /api/dashboard isn't built on the backend yet — null triggers the
      // panel's error state ("SCAN COMPLETE — DATA UNAVAILABLE"), no crash.
      try {
        const res = await fetch(`${backendUrl}/api/dashboard`)
        const data = res.ok ? await res.json() : null
        setScanData(data)
        console.log('[runScan] dashboard fetch:', res.status, data ? 'ok' : 'no data')
      } catch (e) {
        console.log('[runScan] dashboard fetch failed:', e?.message ?? e)
        setScanData(null)
      }
      setScanResultsVisible(true)
      // Auto-scroll to the panel — 600ms lets the slide-up start so the user
      // sees the panel emerging rather than jumping to blank space.
      setTimeout(() => {
        window.scrollBy({ top: 400, behavior: 'smooth' })
      }, 600)
      setTimeout(() => { console.log("[runScan] setScanState('idle')"); setScanState('idle') }, 3000)
    } catch (err) {
      console.log('[runScan] error:', err?.message ?? err)
      setScanState('error')
      setTimeout(() => { console.log("[runScan] setScanState('idle') after error"); setScanState('idle') }, 4000)
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

  const sortedGapsT1 = sortState.gaps_t1.length > 0
    ? sortItems(GAPS_T1, sortState.gaps_t1)
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
          fontFamily:    "'Syne', sans-serif",
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
              fontFamily:    "'IBM Plex Mono', monospace",
              fontSize:      10,
              color:         '#94c864',
              letterSpacing: '0.15em',
            }}>
              LIVE
            </span>
          </div>
          <div style={{
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize:   11,
            color:      '#8892a4',
          }}>
            C<span style={{ color: '#5BA8B5' }}>0</span>insiglieri
          </div>
        </div>
        <style>{`
          @keyframes livePulse {
            0%, 100% { transform: scale(1);   opacity: 1;   }
            50%      { transform: scale(1.4); opacity: 0.4; }
          }
        `}</style>
      </header>

      <HeroCanvas scanState={scanState} />
      <ScanResultsPanel
        ref={scanResultsPanelRef}
        visible={scanResultsVisible}
        scanData={scanData}
        onClose={() => setScanResultsVisible(false)}
      />
      <main ref={mainRef} style={{ background: 'var(--bg-primary)', paddingTop: 48 }}>

{/* Priority Gaps T1 — 2-column grid */}
        <section className="scroll-reveal" style={{ padding: '48px 0' }}>
          <div className="container">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 16, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--t1)' }}>Priority Gaps — Tier 1</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '1px 8px', borderRadius: 99, background: 'var(--t1-dim)', color: 'var(--t1)', border: '1px solid rgba(148,200,100,.3)' }}>{GAPS_T1.length}</span>
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
              <CompetitorChart
                competitors={COMPETITORS}
                siteData={SITE_TABLE_DATA}
                gapsT1={GAPS_T1}
                gapsT2={GAPS_T2}
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
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--cyan)' }}>{SCORE}% EU Presence</span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 300, color: 'var(--text-muted)', textAlign: 'right' }}>Project Horiz<span style={{ color: '#94c864' }}>0</span>n v4 · Sentry · Mirror · Herald</span>
            </div>
          </div>
        </footer>

      </main>
      {activeSite && <OutreachPanel site={activeSite} onClose={() => setActiveSite(null)} />}

      {/* Scan Now — floating button */}
      <button
        onClick={runScan}
        disabled={scanState !== 'idle'}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 50,
          fontFamily: "'IBM Plex Mono', monospace", fontSize: 13,
          color: scanState === 'error' ? '#ff4d6d' : scanState === 'complete' ? '#94c864' : '#00d4e8',
          background: '#131929',
          border: '1px solid rgba(0,212,232,0.3)',
          borderRadius: 8, padding: '12px 20px',
          cursor: scanState === 'idle' ? 'pointer' : 'default',
          transition: 'box-shadow 0.2s, color 0.2s',
          boxShadow: 'none',
        }}
        onMouseEnter={e => { if (scanState === 'idle') e.currentTarget.style.boxShadow = '0 0 16px rgba(0,212,232,0.25)' }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
      >
        {SCAN_LABELS[scanState]}
      </button>

      {/* Scope — floating button, above Intel */}
      {!scopeOpen && (
        <button
          onClick={() => setScopeOpen(true)}
          style={{
            position: 'fixed', bottom: 136, right: 24, zIndex: 50,
            fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 600,
            letterSpacing: '0.04em',
            color: '#94c864',
            background: '#131929',
            border: '1px solid rgba(148,200,100,0.3)',
            borderRadius: 8, padding: '12px 20px',
            cursor: 'pointer',
            transition: 'box-shadow 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 16px rgba(148,200,100,0.25)' }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
        >
          ⊞ Scope
        </button>
      )}

      <AskTheBrief ref={askBriefRef} onSortStrategy={handleSortStrategy} />
      {competitorPanel && (
        <CompetitorPanel
          competitor={competitorPanel}
          onClose={() => setCompetitorPanel(null)}
          onAskIntel={handleAskIntel}
        />
      )}
      <ScopePanel open={scopeOpen} onClose={() => setScopeOpen(false)} />
    </>
  )
}
