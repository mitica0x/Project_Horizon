import { useState, useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import HeroCanvas from './components/HeroCanvas'
import GapCard from './components/GapCard'
import WinCard from './components/WinCard'
import CompetitorChart from './components/CompetitorChart'
import SiteTable from './components/SiteTable'
import OutreachPanel from './components/OutreachPanel'
import AskTheBrief from './components/AskTheBrief'
import { GAPS_T1, GAPS_T2, WINS, SCORE, PAGES_PRESENT, PAGES_TRACKED, TABLE_DATA as SITE_TABLE_DATA, COMPETITORS } from './data/staticData'
import { sortItems, CRITERIA } from './utils/sortEngine'
import SortBar from './components/SortBar'
import CompetitorPanel from './components/CompetitorPanel'
import { computeThreatScore } from './utils/threatScore'

gsap.registerPlugin(ScrollTrigger)

export default function App() {
  const [activeSite, setActiveSite] = useState(null)
  const [scanState, setScanState] = useState('idle')
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

  async function runScan() {
    if (scanState !== 'idle') return
    try {
      for (const agent of ['sentry', 'mirror', 'herald']) {
        setScanState(agent)
        const res = await fetch(`http://localhost:3000/run/${agent}`, { method: 'POST' })
        if (!res.ok) throw new Error(`${agent} failed`)
      }
      setScanState('complete')
      setTimeout(() => setScanState('idle'), 3000)
    } catch {
      setScanState('error')
      setTimeout(() => setScanState('idle'), 4000)
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
      <HeroCanvas />
      <main ref={mainRef} style={{ background: 'var(--bg-primary)' }}>

        {/* North Star Strip */}
        <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg, rgba(0,212,232,0.03) 0%, transparent 60%)' }}>
          <div className="container">
            <p style={{ padding: '18px 0', textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 400, color: 'var(--text-body)', lineHeight: 1.65 }}>
              Bybit owns <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>nothing</span> in EU comparison media.
            </p>
          </div>
        </div>

        {/* Priority Gaps T1 — 2-column grid */}
        <section className="scroll-reveal" style={{ padding: '48px 0' }}>
          <div className="container">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 16, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--t1)' }}>Priority Gaps — Tier 1</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '1px 8px', borderRadius: 99, background: 'var(--t1-dim)', color: 'var(--t1)', border: '1px solid rgba(184,255,0,.3)' }}>{GAPS_T1.length}</span>
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
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '1px 8px', borderRadius: 99, background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid rgba(245,158,11,.3)' }}>{GAPS_T2.length}</span>
            </div>
            <SortBar sectionId="gaps_t2" activeCriteria={sortState.gaps_t2} onToggle={(key) => handleToggle('gaps_t2', key)} onReset={() => handleReset('gaps_t2')} strategyBanner={strategyBanners.gaps_t2} onApplyStrategy={(c) => handleApplyStrategy('gaps_t2', c)} />
            <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 20 }}>
              {sortedGapsT2.map(g => (
                <div key={g.url} style={{ flex: 1, minWidth: 0 }}>
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
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)', marginBottom: 16 }}>Live data from Airtable, fetched on load.</p>
            <SiteTable />
          </div>
        </section>

        <footer style={{ borderTop: '1px solid var(--border)', padding: '28px 0', minHeight: 76 }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 16 }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 300, color: 'var(--text-muted)' }}>Coinsiglieri x Ionut Vilceanu</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--cyan)' }}>{SCORE}% EU Presence</span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 300, color: 'var(--text-muted)', textAlign: 'right' }}>Project Horizon v4 · Sentry · Mirror · Herald</span>
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
          color: scanState === 'error' ? '#ff4d6d' : scanState === 'complete' ? '#00e5a0' : '#00d4e8',
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
      <AskTheBrief ref={askBriefRef} onSortStrategy={handleSortStrategy} />
      {competitorPanel && (
        <CompetitorPanel
          competitor={competitorPanel}
          onClose={() => setCompetitorPanel(null)}
          onAskIntel={handleAskIntel}
        />
      )}
    </>
  )
}
