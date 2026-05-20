import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { CONTACT_EMAIL } from '../config'
import { intelKit } from '../utils/intelKit'
import { AskIntelButton, SiteLink } from './horizonUI'

function buildOutreachMailto(gap) {
  const domain = gap.domain || ''
  const path = gap.path || ''
  const body = `Hi ${domain} team,\n\nI'm reaching out from Bybit EU regarding a potential listing and partnership opportunity on ${domain}${path}.\n\nWe'd love to explore how Bybit could be featured alongside the exchanges you currently recommend.\n\nBest regards,\n${CONTACT_EMAIL}`
  const subject = 'Bybit EU — Partnership & Listing Opportunity'
  return `mailto:${gap.contactEmail || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

// ─── Design tokens (Horizon N0va) ─────────────────────────────────────────────
const HZ = {
  bg:        '#060a10',
  surface:   '#0a0e1a',
  elevated:  '#161b22',
  border:    'rgba(255,255,255,0.06)',
  teal:      '#00d4e8',
  amber:     '#D4A853',
  red:       '#9E1B1B',
  redText:   '#ff6b6b',
  muted:     'rgba(255,255,255,0.35)',
  text:      '#e6edf3',
}
const FONT_BODY = "'Geist', system-ui, sans-serif"
const FONT_MONO = "'Geist Mono', monospace"

const SEVERITY_RANK = { high: 0, medium: 1, low: 2 }
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatScannedAt(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const date = d
      .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      .toUpperCase()
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
    return `${date}  ${time}`
  } catch {
    return '—'
  }
}

// Count from 0 to `target` over `duration` ms with ease-out cubic.
// Resets to 0 when `isActive` is false; restarts whenever it becomes true (or target changes).
function useCountUp(target, isActive, duration = 800) {
  const [val, setVal] = useState(0)
  const targetRef = useRef(target)
  targetRef.current = target
  useEffect(() => {
    if (!isActive) {
      setVal(0)
      return
    }
    let start = null
    let raf
    const step = (ts) => {
      if (start === null) start = ts
      const t = Math.min((ts - start) / duration, 1)
      setVal(Math.round(easeOutCubic(t) * targetRef.current))
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => raf && cancelAnimationFrame(raf)
  }, [isActive, target, duration])
  return val
}

// ─── "vs last scan" diff — snapshot + comparison ───────────────────────────────
//
// On each scan completion the current results are persisted to localStorage so
// the *next* scan can diff against them. The expandable bar diffs the current
// scan against the snapshot that was stored *before* this scan overwrote it
// (captured into prevSnapshot), so the comparison is always current-vs-previous
// rather than current-vs-itself.
const SNAPSHOT_KEY = 'horizon_last_scan_snapshot'

// Diff arrow colours — no red anywhere (per design spec).
const DIFF_LIME = '#94c864'   // positive / good change
const DIFF_AMBER = '#f59e0b'  // neutral / non-positive change
// informational (zero delta) uses HZ.teal (#00d4e8)

const gapKey = (g) => `${g.domain || ''}${g.path || ''}`

// `prev` (optional) lets us carry each gap's first-seen timestamp forward so the
// "how long it was a gap" age in GAPS RESOLVED reflects real elapsed time as
// soon as scan history accumulates. Until then gapAgeDays() seeds a stable age.
function buildSnapshot(scanData, prev) {
  const nowISO = scanData.scannedAt || new Date().toISOString()
  const prevAges = prev?.gapAges || {}
  const gaps = (scanData.gaps || []).map((g) => ({
    domain: g.domain,
    path: g.path,
    tier: g.tier,
    severity: g.severity,
    country: g.country || null,
    geo: normaliseGeo(g.country),
  }))
  const gapAges = {}
  gaps.forEach((g) => {
    const k = gapKey(g)
    gapAges[k] = prevAges[k] || nowISO // first time we see a gap → stamp now
  })
  return {
    score: scanData.score ?? 0,
    tier1Gaps: scanData.tier1Gaps ?? 0,
    brandAlerts: scanData.brandAlerts ?? 0,
    wins: scanData.wins ?? 0,
    gaps,
    // Per-competitor blocked-gap counts — drives competitor momentum (§4).
    competitors: (scanData.competitors || []).map((c) => ({
      name: c.name,
      blocksOnGaps: c.blocksOnGaps ?? 0,
    })),
    scannedAt: nowISO,
    gapAges,
  }
}

// Seeded momentum so a first-ever scan still shows competitor movement (§4b).
const SEED_MOMENTUM = { Revolut: 2, 'Crypto.com': 1, Bitpanda: -1 }

// (e) If no snapshot exists yet, synthesise a slightly-worse prior scan so the
// diff is never blank for the demo: score down 4, two extra (now-resolved)
// T1 gaps, one fewer win, alerts unchanged.
function seedPriorSnapshot(scanData) {
  const cs = buildSnapshot(scanData)
  const nowMs = Date.parse(cs.scannedAt) || Date.now()
  const day = 86400000
  // Prior-only gaps (now resolved in the current scan). Carry geo so GAPS
  // RESOLVED renders "[geo] [tier]", and back-date first-seen so the age reads
  // plausibly (finder 34d, cryptoradar 21d).
  const seededGaps = [
    { domain: 'finder.com', path: '/uk/crypto', tier: 'T1', severity: 'high', country: '🇬🇧 UK', geo: 'UK' },
    { domain: 'cryptoradar.de', path: '/best-exchanges-2024', tier: 'T1', severity: 'high', country: '🇩🇪 DE', geo: 'DE' },
  ]
  const gapAges = { ...cs.gapAges }
  gapAges[gapKey(seededGaps[0])] = new Date(nowMs - 34 * day).toISOString()
  gapAges[gapKey(seededGaps[1])] = new Date(nowMs - 21 * day).toISOString()
  return {
    ...cs,
    score: Math.max(0, cs.score - 4),
    tier1Gaps: cs.tier1Gaps + 2,
    wins: Math.max(0, cs.wins - 1),
    gaps: [...cs.gaps, ...seededGaps],
    // Prior competitor counts inverted by SEED_MOMENTUM so the current scan
    // shows the example movement (Revolut +2, Crypto.com +1, Bitpanda −1).
    competitors: cs.competitors.map((c) => ({
      name: c.name,
      blocksOnGaps: Math.max(0, c.blocksOnGaps - (SEED_MOMENTUM[c.name] ?? 0)),
    })),
    gapAges,
    scannedAt: new Date(nowMs - 7 * day).toISOString(),
    __seeded: true,
  }
}

function pluralWord(n, word) {
  return `${word}${Math.abs(n) === 1 ? '' : 's'}`
}

// Tone → colour. Lime = positive, amber = watch, cyan = neutral. No red here.
const DIFF_TONE = { lime: DIFF_LIME, amber: DIFF_AMBER, cyan: HZ.teal }

// Deterministic FNV-1a hash — keeps every seeded value stable across renders so
// mock fields never flicker. Real data replaces these the moment it exists.
function seedHash(str) {
  let h = 2166136261
  for (let i = 0; i < String(str).length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function seedPick(arr, h) {
  return arr[h % arr.length]
}

function geoLabel(g) {
  return (g.geo || normaliseGeo(g.country) || 'GLOBAL').toUpperCase()
}

const SEED_CLOSE_COMPS = ['Kraken', 'Coinbase', 'Bitpanda', 'OKX', 'Bitget']
const SEED_ALERT_SITES = ['trustpilot.com', 'reddit.com/r/crypto', 'x.com/search', 'producthunt.com']
const SEED_COMP_SITES = [
  'cryptocompare.com/exchanges',
  'finder.com/uk',
  'coingecko.com/exchanges',
  'investopedia.com/best-crypto-exchanges',
]

// Real gap age once history exists; otherwise a stable seeded 14–58 days.
function gapAgeDays(key, prev, nowMs) {
  const seen = prev?.gapAges?.[key]
  if (seen) {
    const d = Math.round((nowMs - Date.parse(seen)) / 86400000)
    if (Number.isFinite(d) && d >= 0) return d
  }
  return 14 + (seedHash(key) % 45)
}

// Build the full diff model: one structured section per spec block. Every
// section carries production shape (rows: {tone, primary, sub[]}); seeded
// values only fill fields the snapshot can't yet derive.
function buildDiffSections(scanData, prev) {
  if (!prev) {
    return { hasPrevious: false, scoreDelta: 0, gapsDelta: 0, winsDelta: 0, alertsDelta: 0, sections: [] }
  }

  const curr = buildSnapshot(scanData)
  const nowMs = Date.parse(curr.scannedAt) || Date.now()
  const prevKeys = new Set((prev.gaps || []).map(gapKey))
  const currKeys = new Set(curr.gaps.map(gapKey))
  const resolved = (prev.gaps || []).filter((g) => !currKeys.has(gapKey(g)))
  const opened = curr.gaps.filter((g) => !prevKeys.has(gapKey(g)))
  // Map opened snapshot gaps back to the live scan gap (has description) so we
  // can name the competitors actually present.
  const liveByKey = {}
  ;(scanData.gaps || []).forEach((g) => {
    liveByKey[gapKey(g)] = g
  })

  const scoreDelta = curr.score - prev.score
  const gapsDelta = curr.tier1Gaps - prev.tier1Gaps
  const winsDelta = curr.wins - prev.wins
  const alertsDelta = curr.brandAlerts - prev.brandAlerts

  // ── Competitor movement (feeds SCORE factors + its own section) ──
  const moves = (scanData.competitors || [])
    .map((c) => {
      const p = (prev.competitors || []).find((x) => x.name === c.name)
      const delta =
        p != null ? (c.blocksOnGaps ?? 0) - p.blocksOnGaps : SEED_MOMENTUM[c.name] ?? 0
      const h = seedHash(c.name)
      const geoS = seedPick(['UK', 'DE', 'EU', 'Global'], h)
      const tierS = seedPick(['T1', 'T2'], h >> 3)
      const siteS = seedPick(SEED_COMP_SITES, h >> 5)
      let glyph, tone, text
      if (delta >= 2) {
        glyph = '↑↑'
        tone = 'amber'
        text = `appeared on ${delta} new ${geoS} ${tierS} pages since last scan`
      } else if (delta === 1) {
        glyph = '↑'
        tone = 'amber'
        text = `added 1 ${geoS} ${tierS} listing`
      } else if (delta <= -1) {
        glyph = '↓'
        tone = 'lime'
        text = `dropped from ${siteS}`
      } else {
        glyph = '→'
        tone = 'cyan'
        text = 'no change detected across tracked pages'
      }
      return { name: c.name, delta, glyph, tone, text }
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  // ── SCORE CHANGE ──
  const byTier = (list) =>
    list.reduce((m, g) => {
      const t = g.tier || 'T2'
      ;(m[t] ||= []).push(g)
      return m
    }, {})
  const resByTier = byTier(resolved)
  const openByTier = byTier(opened)
  const factors = []
  ;['T1', 'T2', 'T3'].forEach((t) => {
    const arr = resByTier[t]
    if (arr && arr.length) {
      const pts = arr.length * (TIER_POINTS[t] ?? 1)
      const names = arr.slice(0, 2).map((g) => `${g.domain}${g.path || ''}`).join(', ')
      factors.push({
        sign: '+',
        pts,
        tone: 'lime',
        text: `${arr.length} ${t} ${pluralWord(arr.length, 'gap')} closed (${names})`,
      })
    }
  })
  ;['T1', 'T2', 'T3'].forEach((t) => {
    const arr = openByTier[t]
    if (arr && arr.length) {
      const pts = arr.length * (TIER_POINTS[t] ?? 1)
      const names = arr.slice(0, 2).map((g) => `${g.domain}${g.path || ''}`).join(', ')
      factors.push({
        sign: '-',
        pts,
        tone: 'amber',
        text: `${arr.length} new ${t} ${pluralWord(arr.length, 'gap')} (${names})`,
      })
    }
  })
  moves.forEach((m) => {
    if (m.delta <= -1) {
      const n = Math.abs(m.delta)
      factors.push({
        sign: '+',
        pts: 1,
        tone: 'lime',
        text: `${m.name} momentum slowed (↓ on ${n} tracked ${pluralWord(n, 'page')})`,
      })
    } else if (m.delta >= 1) {
      factors.push({
        sign: '-',
        pts: 1,
        tone: 'amber',
        text: `${m.name} momentum up (↑ on ${m.delta} tracked ${pluralWord(m.delta, 'page')})`,
      })
    }
  })
  // Reconcile the factor sum to the real score delta so the breakdown is honest.
  const factorSum = factors.reduce((s, f) => s + (f.sign === '+' ? f.pts : -f.pts), 0)
  const residual = scoreDelta - factorSum
  if (residual !== 0) {
    factors.push({
      sign: residual > 0 ? '+' : '-',
      pts: Math.abs(residual),
      tone: residual > 0 ? 'lime' : 'amber',
      text:
        residual > 0
          ? 'field pressure eased (aggregate signal shift)'
          : 'field pressure rose (aggregate signal shift)',
    })
  }
  if (factors.length === 0) {
    factors.push({ sign: '·', pts: 0, tone: 'cyan', text: 'no contributing changes — score held flat' })
  }
  const scoreSection = {
    id: 'score',
    label: 'SCORE CHANGE',
    badge: {
      glyph: scoreDelta > 0 ? '↑' : scoreDelta < 0 ? '↓' : '→',
      value: Math.abs(scoreDelta),
      tone: scoreDelta > 0 ? 'lime' : scoreDelta < 0 ? 'amber' : 'cyan',
    },
    head: `From ${prev.score} → ${curr.score}`,
    rows: factors.map((f) => ({
      tone: f.tone,
      primary: `${f.sign} ${f.pts}${Math.abs(f.pts) === 1 ? 'pt' : 'pts'} — ${f.text}`,
    })),
  }

  // ── GAPS RESOLVED ── (Bybit now listed — render URL as a green win link)
  const resolvedRows = resolved.map((g) => {
    const url = `${g.domain}${g.path || ''}`
    const k = gapKey(g)
    const age = gapAgeDays(k, prev, nowMs)
    const h = seedHash(k)
    let trig = seedPick(SEED_CLOSE_COMPS, h)
    const along = seedPick(SEED_CLOSE_COMPS, h >> 4)
    if (trig === along) trig = seedPick(SEED_CLOSE_COMPS, h >> 7)
    return {
      tone: 'lime',
      url,
      urlKind: 'win',
      tail: ` — ${geoLabel(g)} ${g.tier || 'T2'} — was missing, now listed`,
      sub: [`gap open ${age} days · Bybit added alongside ${trig}`],
    }
  })
  const gapsResolvedSection = {
    id: 'resolved',
    label: 'GAPS RESOLVED',
    badge: { glyph: '↓', value: resolved.length, tone: resolved.length ? 'lime' : 'cyan' },
    rows: resolvedRows,
    empty: resolvedRows.length === 0,
    emptyText: 'No gaps resolved since last scan',
  }

  // ── NEW GAPS OPENED ── (Bybit absent — render URL as a cyan gap link)
  const openedRows = opened.map((g) => {
    const live = liveByKey[gapKey(g)] || g
    const comps = competitorsForGap(live)
    const url = `${g.domain}${g.path || ''}`
    return {
      tone: 'amber',
      url,
      urlKind: 'gap',
      tail: ` — ${geoLabel(g)} ${g.tier || 'T2'} — ${comps.join(' + ')} present, Bybit absent`,
    }
  })
  const newGapsSection = {
    id: 'opened',
    label: 'NEW GAPS OPENED',
    badge: { glyph: '↑', value: opened.length, tone: opened.length ? 'amber' : 'cyan' },
    rows: openedRows,
    empty: openedRows.length === 0,
    emptyText: 'No new gaps opened — Bybit holding ground',
  }

  // ── WINS — confirmed listings, sourced from resolved gaps ──
  const winCount = Math.max(0, winsDelta)
  const detected = formatScannedAt(curr.scannedAt)
  const impactFor = (t) =>
    t === 'T1'
      ? 'T1 authority page · est. high editorial reach'
      : t === 'T2'
      ? 'T2 page · moderate qualified reach'
      : 'T3 page · niche but on-intent reach'
  const winRows =
    winsDelta > 0
      ? resolved.slice(0, winCount).map((g) => {
          const url = `${g.domain}${g.path || ''}`
          return {
            tone: 'lime',
            url,
            urlKind: 'win',
            tail: ` — ${geoLabel(g)} ${g.tier || 'T2'}`,
            sub: [`Confirmed: Bybit now listed · ${detected}`, `Impact: ${impactFor(g.tier)}`],
          }
        })
      : []
  const winsSection = {
    id: 'wins',
    label: 'WINS',
    badge: {
      glyph: winsDelta > 0 ? '↑' : winsDelta < 0 ? '↓' : '→',
      value: Math.abs(winsDelta),
      tone: winsDelta > 0 ? 'lime' : winsDelta < 0 ? 'amber' : 'cyan',
    },
    rows: winRows,
    empty: winRows.length === 0,
    emptyText:
      winsDelta < 0
        ? `${Math.abs(winsDelta)} ${pluralWord(winsDelta, 'listing')} lost since last scan`
        : 'No new wins since last scan',
  }

  // ── ALERTS — only a count is known; seed plausible rows when raised ──
  let alertRows = []
  if (alertsDelta > 0) {
    alertRows = Array.from({ length: alertsDelta }).map((_, i) => {
      const h = seedHash(`alert${i}${curr.scannedAt}`)
      const site = seedPick(SEED_ALERT_SITES, h)
      const why = seedPick(
        [
          'competitor block strengthened',
          'negative sentiment cluster forming',
          'listing demoted below the fold',
          'editorial refresh excluded Bybit',
        ],
        h >> 3
      )
      return { tone: 'amber', primary: `${site} — ${why} — worth a same-day look` }
    })
  }
  const alertsSection = {
    id: 'alerts',
    label: 'ALERTS',
    badge: {
      glyph: alertsDelta > 0 ? '↑' : alertsDelta < 0 ? '↓' : '→',
      value: Math.abs(alertsDelta),
      tone: alertsDelta > 0 ? 'amber' : 'cyan',
    },
    rows: alertRows,
    empty: alertRows.length === 0,
    emptyText:
      alertsDelta < 0
        ? `${Math.abs(alertsDelta)} ${pluralWord(alertsDelta, 'alert')} cleared — field stable`
        : 'No new alerts since last scan — field stable',
  }

  // ── COMPETITOR MOVES — always shown, every tracked competitor ──
  const moverCount = moves.filter((m) => m.delta !== 0).length
  const anyGain = moves.some((m) => m.delta > 0)
  const compSection = {
    id: 'competitors',
    label: 'COMPETITOR MOVES',
    badge: {
      glyph: anyGain ? '↑' : moverCount ? '↓' : '→',
      value: moverCount,
      tone: anyGain ? 'amber' : moverCount ? 'lime' : 'cyan',
    },
    rows: moves.map((m) => ({ tone: m.tone, primary: `${m.name} ${m.glyph} — ${m.text}` })),
    empty: moves.length === 0,
    emptyText: 'No tracked competitors',
  }

  return {
    hasPrevious: true,
    scoreDelta,
    gapsDelta,
    winsDelta,
    alertsDelta,
    sections: [
      scoreSection,
      gapsResolvedSection,
      newGapsSection,
      winsSection,
      alertsSection,
      compSection,
    ],
  }
}

function ChevronIcon({ open }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{
        display: 'block',
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.25s ease',
      }}
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ─── Intelligence layer — OPP scoring · competitor parsing · market map ─────────

const TIER_WEIGHT = { T1: 1.0, T2: 0.6, T3: 0.3 }
const TIER_POINTS = { T1: 4, T2: 2, T3: 1 } // presence points per closed gap (§3a)

// Closability derived from tier — T1 assumed editorial unless flagged paid.
function closabilityFor(gap) {
  if (gap.tier === 'T1') return gap.paid || gap.placement === 'paid' ? 0.9 : 0.7
  if (gap.tier === 'T2') return 0.85
  return 0.95
}

// Known competitors → stable abbreviation + identity colour, consistent
// everywhere in the market map and breakdowns.
// Locked default competitor set — canonical order, exactly the 12 defaults.
const COMPETITOR_META = {
  Binance: { abbr: 'BIN', color: '#f3ba2f' },
  Kraken: { abbr: 'KR', color: '#8a7cff' },
  Coinbase: { abbr: 'CB', color: '#4f87ff' },
  Bitpanda: { abbr: 'BP', color: '#3ad29f' },
  OKX: { abbr: 'OKX', color: '#cbd5e1' },
  'Crypto.com': { abbr: 'CP', color: '#3b6ef5' },
  Revolut: { abbr: 'REV', color: '#a78bfa' },
  KuCoin: { abbr: 'KU', color: '#22c39a' },
  Bitget: { abbr: 'BG', color: '#00c2a8' },
  WhiteBit: { abbr: 'WB', color: '#94a3b8' },
  MEXC: { abbr: 'MX', color: '#5b8def' },
  BingX: { abbr: 'BX', color: '#7c83ff' },
}
const COMPETITOR_NAMES = Object.keys(COMPETITOR_META)
const PALETTE = ['#a78bfa', '#f3ba2f', '#3b6ef5', '#3ad29f', '#8a7cff', '#4f87ff', '#2bd1d1', '#6aa0ff']

function competitorMeta(name) {
  if (COMPETITOR_META[name]) return COMPETITOR_META[name]
  const clean = (name || '').replace(/[^A-Za-z0-9]/g, '')
  let h = 0
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return { abbr: clean.slice(0, 3).toUpperCase() || '??', color: PALETTE[h % PALETTE.length] }
}

const GEOS = ['UK', 'DE', 'EU', 'Global']
const TIERS = ['T1', 'T2', 'T3']

function normaliseGeo(country) {
  if (!country) return 'Global'
  const token = String(country).replace(/[^A-Za-z]/g, ' ').trim().split(/\s+/).pop()
  const t = (token || '').toUpperCase()
  if (t === 'UK' || t === 'GB') return 'UK'
  if (t === 'DE') return 'DE'
  if (t === 'EU') return 'EU'
  return 'Global'
}

// Competitors named in a gap's description; falls back to a tier/geo-consistent
// seed so the market map / density is never empty (§2c).
function competitorsForGap(gap) {
  const desc = (gap.description || '').toLowerCase()
  const found = COMPETITOR_NAMES.filter((n) => desc.includes(n.toLowerCase()))
  if (found.length) return found
  const geo = normaliseGeo(gap.country)
  if (geo === 'UK') return ['Revolut']
  if (geo === 'DE') return ['Bitpanda']
  if (geo === 'EU') return ['OKX']
  return ['Binance']
}

function densityFactor(n) {
  if (n <= 1) return 1.0
  if (n === 2) return 0.8
  return 0.6
}

// OPP — page reach (tier) × competitor density × closability, 0–100 (§1a).
function oppScore(gap) {
  const tw = TIER_WEIGHT[gap.tier] ?? 0.6
  const dens = densityFactor(competitorsForGap(gap).length)
  const clos = closabilityFor(gap)
  return Math.max(0, Math.min(100, Math.round(tw * dens * clos * 100)))
}

function oppColor(opp) {
  if (opp >= 80) return '#94c864' // lime
  if (opp >= 50) return '#f59e0b' // amber
  return '#00d4e8' // cyan
}

// §3a — top-3 OPP gaps; T1 closed = +4, T2 = +2, T3 = +1.
function projectionFor(sortedByOpp, currentScore) {
  const top3 = sortedByOpp.slice(0, 3)
  const gain = top3.reduce((s, g) => s + (TIER_POINTS[g.tier] ?? 1), 0)
  return { top3, gain, projected: Math.min(100, currentScore + gain) }
}

const gapSlug = (g) =>
  `${g.domain || ''}${g.path || ''}`.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')

const gapUrl = (g) => `${g.domain || ''}${g.path || ''}`

function intentFor(gap) {
  const s = `${gap.path || ''} ${gap.description || ''}`.toLowerCase()
  if (s.includes('compar') || s.includes('best') || s.includes('vs')) return 'comparison intent'
  if (s.includes('review')) return 'review intent'
  if (s.includes('news') || s.includes('cointelegraph')) return 'editorial reach'
  return 'high traffic'
}

// Cell seed consistent with scan seed data (§2c).
const FIELD_SEED = {
  'T1|UK': ['Revolut'],
  'T1|Global': ['Binance'],
  'T1|EU': ['OKX'],
  'T1|DE': ['Bitpanda'],
  'T2|Global': ['Coinbase', 'Kraken'],
}

// Build the tier×geo matrix from real scan gaps, seeding empties.
function buildFieldMap(gaps) {
  const matrix = {}
  TIERS.forEach((tier) => {
    matrix[tier] = {}
    GEOS.forEach((geo) => {
      const cellGaps = gaps.filter((g) => g.tier === tier && normaliseGeo(g.country) === geo)
      if (cellGaps.length) {
        const counts = {}
        cellGaps.forEach((g) =>
          competitorsForGap(g).forEach((c) => {
            counts[c] = (counts[c] || 0) + 1
          })
        )
        matrix[tier][geo] = {
          state: 'gap',
          comps: Object.keys(counts),
          counts,
          gap: cellGaps[0],
          gapCount: cellGaps.length,
        }
      } else if (FIELD_SEED[`${tier}|${geo}`]) {
        const comps = FIELD_SEED[`${tier}|${geo}`]
        matrix[tier][geo] = {
          state: 'owned',
          comps,
          counts: Object.fromEntries(comps.map((c) => [c, 1])),
        }
      } else {
        matrix[tier][geo] = { state: 'bybit', comps: [], counts: {} }
      }
    })
  })
  return matrix
}

function momentumFor(comp, prevSnapshot) {
  const prev = prevSnapshot?.competitors?.find((c) => c.name === comp.name)
  const delta =
    prev != null ? (comp.blocksOnGaps ?? 0) - prev.blocksOnGaps : SEED_MOMENTUM[comp.name] ?? 0
  let glyph, color
  if (delta >= 2) {
    glyph = '↑↑'
    color = '#ef4444' // competitor threat — red is intentional here
  } else if (delta === 1) {
    glyph = '↑'
    color = '#ef4444'
  } else if (delta <= -1) {
    glyph = '↓'
    color = '#94c864' // they lost ground — good for us
  } else {
    glyph = '→'
    color = 'rgba(255,255,255,0.45)'
  }
  return { delta, glyph, color }
}

const SEED_NARRATIVE = {
  Revolut: 'Added 2 T1 slots across UK and DE — active campaign detected.',
  Binance: 'Stable. No new listings this scan.',
  Bitpanda: 'Lost 1 DE listing. Retreating in local market.',
  Kraken: 'No movement. Holding existing slots.',
  'Crypto.com': 'Added 1 EU T2 slot. Expanding continental reach.',
}

function narrativeFor(comp, momentum, blockedGaps) {
  if (SEED_NARRATIVE[comp.name] && momentum.delta === (SEED_MOMENTUM[comp.name] ?? 0)) {
    return SEED_NARRATIVE[comp.name]
  }
  const geos = [...new Set(blockedGaps.map((g) => normaliseGeo(g.country)))]
  const geoStr = geos.slice(0, 2).join(' and ') || 'multiple markets'
  if (momentum.delta >= 2) return `Added ${momentum.delta} slots across ${geoStr} — active campaign detected.`
  if (momentum.delta === 1) return `Added 1 ${geos[0] || 'EU'} slot. Expanding continental reach.`
  if (momentum.delta <= -1)
    return `Lost ${Math.abs(momentum.delta)} ${geos[0] || 'local'} listing. Retreating in local market.`
  return 'No movement. Holding existing slots.'
}

// ─── §5b Market moves — real-world competitive events ──────────────────────────
// Sponsorships, filings, launches, brand events. These don't show on affiliate
// pages — they change the competitive landscape directly. `expanding` → ↑↑
// amber (brand-expanding); `neutral` → no amber border, muted; otherwise a
// single ↑ amber (maintained presence). `placement` overrides the placement
// narrative for competitors not yet on tracked pages (e.g. WhiteBit).
const MARKET_MOVES = {
  WhiteBit: {
    expanding: true,
    placement:
      'No placement data — not yet on tracked affiliate pages in EU market.',
    move:
      'FC Barcelona sponsorship confirmed. Front-of-shirt deal. European reach: 300M+ impressions. Significant T1 brand visibility event in key Bybit markets.',
    impact:
      'Brand move of this scale typically accelerates affiliate listing requests within 60 days.',
  },
  Binance: {
    expanding: true,
    move:
      'MiCA compliance filing published — EU regulatory positioning ahead of enforcement deadline. Likely to strengthen EU affiliate relationships.',
  },
  Revolut: {
    neutral: true,
    move: 'No major announcements detected this cycle.',
  },
  Kraken: {
    expanding: true,
    move:
      'Kraken Pro relaunch announced — targeting advanced traders. May shift editorial framing on comparison sites toward pro positioning.',
  },
  OKX: {
    expanding: false,
    move:
      'Champions League sleeve sponsor renewal confirmed. European brand presence maintained.',
  },
}
const MARKET_MOVE_NAMES = Object.keys(MARKET_MOVES)

// §5d outreach prompt fed to the existing INTEL panel. Exact spec text — the
// page already lists competitors and we want to propose an affiliate or
// sponsored listing.
function outreachPrompt(gap) {
  const url = gapUrl(gap)
  return (
    `Draft a cold outreach email to the editor or partnerships team at ${url}. ` +
    `Context: this page currently lists Bybit's competitors (Crypto.com, OKX etc.) ` +
    `but does not mention Bybit. We want to propose an affiliate partnership or ` +
    `sponsored listing. Tone: professional, direct, no fluff.`
  )
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function Tooltip({ label, children }) {
  const [show, setShow] = useState(false)
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#0d1320',
            border: `1px solid ${HZ.border}`,
            borderRadius: 4,
            padding: '6px 9px',
            fontFamily: FONT_MONO,
            fontSize: 10,
            lineHeight: 1.4,
            color: HZ.text,
            whiteSpace: 'nowrap',
            zIndex: 20,
            pointerEvents: 'none',
            boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
          }}
        >
          {label}
        </span>
      )}
    </span>
  )
}

function OppBadge({ opp }) {
  const color = oppColor(opp)
  return (
    <Tooltip label="Score based on page reach, competitor density, and gap closability.">
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: 10,
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: 3,
          background: `${color}1a`,
          color,
          border: `1px solid ${color}40`,
          letterSpacing: '0.05em',
          whiteSpace: 'nowrap',
          cursor: 'help',
        }}
      >
        OPP {opp}
      </span>
    </Tooltip>
  )
}

function CompChip({ name, count, tier, geo, lime }) {
  const meta = lime ? { abbr: 'BY', color: '#94c864' } : competitorMeta(name)
  const chip = (
    <span
      style={{
        fontFamily: FONT_MONO,
        fontSize: 10,
        fontWeight: 700,
        padding: '2px 6px',
        borderRadius: 3,
        background: `${meta.color}22`,
        color: meta.color,
        border: `1px solid ${meta.color}55`,
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
      }}
    >
      {meta.abbr}
    </span>
  )
  if (lime) return chip
  return (
    <Tooltip label={`${name} holds ${count ?? 1} slot${(count ?? 1) === 1 ? '' : 's'} in ${tier} ${geo}.`}>
      {chip}
    </Tooltip>
  )
}

function PulseDot() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: HZ.teal,
        animation: 'srpPulse 2s ease-in-out infinite',
      }}
    />
  )
}

function TierBadge({ tier }) {
  const teal = tier === 'T1'
  return (
    <span
      style={{
        fontFamily: FONT_MONO,
        fontSize: 10,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 3,
        background: teal ? 'rgba(0,212,232,0.1)' : 'rgba(212,168,83,0.1)',
        color: teal ? HZ.teal : HZ.amber,
        border: `1px solid ${teal ? 'rgba(0,212,232,0.2)' : 'rgba(212,168,83,0.2)'}`,
        letterSpacing: '0.05em',
      }}
    >
      {tier}
    </span>
  )
}

function SeverityBadge({ severity }) {
  let bg, fg, bd, label
  if (severity === 'high') {
    bg = 'rgba(158,27,27,0.15)'
    fg = HZ.redText
    bd = 'rgba(158,27,27,0.3)'
    label = 'HIGH'
  } else if (severity === 'medium') {
    bg = 'rgba(212,168,83,0.1)'
    fg = HZ.amber
    bd = 'rgba(212,168,83,0.2)'
    label = 'MED'
  } else {
    bg = 'rgba(0,212,232,0.08)'
    fg = HZ.teal
    bd = 'rgba(0,212,232,0.15)'
    label = 'LOW'
  }
  return (
    <span
      style={{
        fontFamily: FONT_MONO,
        fontSize: 10,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 3,
        background: bg,
        color: fg,
        border: `1px solid ${bd}`,
        letterSpacing: '0.05em',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

// positiveIsGood: true for score/wins (higher = better);
//                 false for gaps/alerts (lower = better — fewer is good).
function DeltaChip({ label, delta, positiveIsGood }) {
  const positive = delta > 0
  const negative = delta < 0
  const good = (positive && positiveIsGood) || (negative && !positiveIsGood)
  const bg = good ? 'rgba(0,212,232,0.08)' : 'rgba(158,27,27,0.15)'
  const fg = good ? HZ.teal : HZ.redText
  const bd = good ? 'rgba(0,212,232,0.15)' : 'rgba(158,27,27,0.3)'
  const arrow = positive ? '↑' : negative ? '↓' : '·'
  return (
    <span
      style={{
        fontFamily: FONT_MONO,
        fontSize: 10,
        fontWeight: 600,
        padding: '3px 10px',
        borderRadius: 3,
        background: bg,
        color: fg,
        border: `1px solid ${bd}`,
        letterSpacing: '0.06em',
        whiteSpace: 'nowrap',
      }}
    >
      {label} {arrow}
      {Math.abs(delta)}
    </span>
  )
}

// One sub-row of the "vs last scan" panel. Header = uppercase cyan label +
// tone-coloured [glyph value] badge; body = rows with a tone-coloured primary
// line and optional muted "└ sub" lines.
//
// `staticOpen` mode locks the section open and hides the chevron / makes the
// header non-interactive — used when the section is inside a tab pane (the
// tab itself is the navigation, no nested toggles).
function DiffSection({ section, open, onToggle, staticOpen = false }) {
  const badgeColor = DIFF_TONE[section.badge.tone] || HZ.teal
  const effectiveOpen = staticOpen || open
  return (
    <div>
      <div
        {...(staticOpen
          ? {}
          : {
              role: 'button',
              tabIndex: 0,
              'aria-expanded': open,
              'aria-label': `Toggle ${section.label}`,
              onClick: onToggle,
              onKeyDown: (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onToggle()
                }
              },
            })}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          cursor: staticOpen ? 'default' : 'pointer',
          userSelect: 'none',
          padding: '4px 0',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              color: HZ.teal,
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            {section.label}
          </span>
          <span style={{ color: badgeColor, fontWeight: 700, fontSize: 11 }}>
            [{section.badge.glyph}
            {section.badge.value}]
          </span>
        </span>
        {!staticOpen && (
          <span style={{ color: HZ.muted, display: 'inline-flex' }}>
            <ChevronIcon open={open} />
          </span>
        )}
      </div>
      <div
        style={{
          maxHeight: effectiveOpen ? 1400 : 0,
          opacity: effectiveOpen ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.3s cubic-bezier(0.16,1,0.3,1), opacity 0.25s ease',
        }}
        aria-hidden={!effectiveOpen}
      >
        <div
          style={{ padding: '6px 0 4px 2px', display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {section.head && (
            <div style={{ color: HZ.text, fontWeight: 600 }}>{section.head}</div>
          )}
          {section.empty ? (
            <div style={{ color: HZ.muted }}>{section.emptyText}</div>
          ) : (
            section.rows.map((r, i) => {
              const rowColor = DIFF_TONE[r.tone] || HZ.muted
              const isWin = r.urlKind === 'win'
              const linkHref = r.url
                ? (r.url.startsWith('http') ? r.url : `https://${r.url}`)
                : null
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {r.url ? (
                    <div style={{ color: rowColor }}>
                      <a
                        href={linkHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title={`Open ${r.url} — verify Bybit ${isWin ? 'presence' : 'absence'}`}
                        style={{
                          color: isWin ? 'var(--green)' : 'var(--cyan)',
                          textDecoration: 'underline',
                          cursor: 'pointer',
                        }}
                      >
                        {r.url}
                      </a>
                      {r.tail || ''}
                    </div>
                  ) : (
                    <div style={{ color: rowColor }}>{r.primary}</div>
                  )}
                  {(r.sub || []).map((s, j) => (
                    <div key={j} style={{ color: HZ.muted, paddingLeft: 12 }}>
                      └ {s}
                    </div>
                  ))}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  suffix,
  valueColor,
  deltaText,
  deltaColor,
  isVisible,
  withBar,
  barPct,
  footer,
}) {
  const animated = useCountUp(value ?? 0, isVisible, 800)
  return (
    <div
      style={{
        background: HZ.surface,
        border: `1px solid ${HZ.border}`,
        borderRadius: 6,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minHeight: 84,
      }}
    >
      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: 10,
          color: HZ.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 32,
            fontWeight: 700,
            color: valueColor,
            lineHeight: 1,
          }}
        >
          {animated}
          {suffix}
        </span>
        {deltaText && (
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              fontWeight: 600,
              color: deltaColor,
              lineHeight: 1,
            }}
          >
            {deltaText}
          </span>
        )}
      </div>
      {footer}
      {withBar && (
        <div
          style={{
            marginTop: 4,
            height: 3,
            width: '100%',
            background: HZ.elevated,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              background: HZ.teal,
              width: isVisible ? `${barPct ?? 0}%` : '0%',
              transition: 'width 800ms cubic-bezier(0.16,1,0.3,1)',
            }}
          />
        </div>
      )}
    </div>
  )
}

// §5b — real-world market-move block, rendered below the placement narrative.
// Amber 3px left border + ↑↑ for brand-expanding moves; neutral → no border.
function MarketMoveBlock({ mm }) {
  const amber = '#D4A853'
  const isNeutral = !!mm.neutral
  const glyph = isNeutral ? '→' : mm.expanding ? '↑↑' : '↑'
  const accent = isNeutral ? HZ.muted : amber
  return (
    <div
      style={{
        marginTop: 8,
        paddingLeft: 10,
        borderLeft: isNeutral
          ? '3px solid rgba(255,255,255,0.08)'
          : `3px solid ${amber}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: FONT_MONO,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: accent,
          marginBottom: 4,
        }}
      >
        MARKET MOVE
        <span style={{ fontSize: 12 }}>{glyph}</span>
      </div>
      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: 12,
          lineHeight: 1.6,
          color: isNeutral ? HZ.muted : '#c8d0dc',
        }}
      >
        {mm.move}
      </div>
      {mm.impact && (
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10,
            color: HZ.muted,
            marginTop: 4,
            fontStyle: 'italic',
          }}
        >
          {mm.impact}
        </div>
      )}
    </div>
  )
}

// §5c — per-competitor battle plan: top-3 OPP gaps where they are listed and
// Bybit is absent. Closing these directly reduces their dominance.
function BattlePlan({ comp, gaps, onDraft }) {
  const top3 = gaps.slice(0, 3)
  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${HZ.border}` }}>
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#ffffff',
          marginBottom: 4,
        }}
      >
        Battle Plan vs {comp.name.toUpperCase()}
      </div>
      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: 12,
          color: HZ.muted,
          marginBottom: 10,
          lineHeight: 1.5,
        }}
      >
        {top3.length
          ? `${top3.length} gap${top3.length === 1 ? '' : 's'} where ${comp.name} is listed and Bybit is absent — closing these directly reduces their dominance.`
          : `No tracked gaps where ${comp.name} is currently listed — monitor the market move above.`}
      </div>
      {top3.map((g, i) => {
        const opp = g._opp ?? oppScore(g)
        const geo = normaliseGeo(g.country)
        return (
          <div key={i} style={{ marginBottom: 10 }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: HZ.text }}>
              <span style={{ color: HZ.teal }}>&rarr; </span>
              <SiteLink domain={g.domain} path={g.path}>{gapUrl(g)}</SiteLink> <span style={{ color: HZ.muted }}>&mdash; {geo} {g.tier}</span>{' '}
              <span style={{ color: oppColor(opp), fontWeight: 700 }}>&mdash; OPP {opp}</span>
            </div>
            <div
              style={{
                fontFamily: FONT_BODY,
                fontSize: 12,
                color: HZ.muted,
                margin: '3px 0 5px',
                paddingLeft: 14,
                lineHeight: 1.5,
              }}
            >
              Closing this removes {comp.name}&rsquo;s exclusive advantage on {geo}{' '}
              {intentFor(g)} traffic.
            </div>
            <div style={{ paddingLeft: 14 }}>
              <button
                onClick={() => onDraft?.(g)}
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  padding: '3px 9px',
                  borderRadius: 3,
                  cursor: 'pointer',
                  background: 'transparent',
                  color: HZ.teal,
                  border: '1px solid rgba(0,212,232,0.4)',
                }}
              >
                DRAFT OUTREACH
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CompetitorRow({ comp, maxScore, isVisible, index, momentum, blockedGaps, realMove, onDraft }) {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)
  const pct = maxScore > 0 ? (comp.threatScore / maxScore) * 100 : 0
  // Real news headline (Section 9) takes precedence over the seeded narrative;
  // the seeded placement line overrides only when there is no real move.
  const seededMove = MARKET_MOVES[comp.name]
  const narrative = realMove?.headline
    ? `${realMove.headline}${realMove.impact_level ? ` [${realMove.impact_level}]` : ''}`
    : seededMove?.placement || narrativeFor(comp, momentum, blockedGaps)
  // §5b — unified market-move block: real backend move if present, else seed.
  const mmBlock = realMove?.headline
    ? {
        move: realMove.headline,
        impact: realMove.impact_level ? `Impact level: ${realMove.impact_level}.` : null,
        expanding: true,
      }
    : seededMove
  const topGap = blockedGaps[0]
  return (
    <div style={{ borderBottom: `1px solid ${HZ.border}` }}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen((o) => !o)
          }
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          cursor: 'pointer',
          padding: '10px 6px',
          background: hover ? HZ.elevated : 'transparent',
          transition: 'background 0.15s',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ minWidth: 116, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 500, color: HZ.text }}>
              {comp.name}
            </span>
            <Tooltip
              label={
                momentum.delta > 0
                  ? `Gained ${momentum.delta} listing${momentum.delta === 1 ? '' : 's'} since last scan`
                  : momentum.delta < 0
                    ? `Lost ${Math.abs(momentum.delta)} listing${Math.abs(momentum.delta) === 1 ? '' : 's'}`
                    : 'No change since last scan'
              }
            >
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 12,
                  fontWeight: 700,
                  color: momentum.color,
                  cursor: 'help',
                }}
              >
                {momentum.glyph}
              </span>
            </Tooltip>
          </div>
          <div
            style={{
              flex: 1,
              height: 3,
              background: HZ.elevated,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                background: HZ.teal,
                width: isVisible ? `${pct}%` : '0%',
                transition: `width 600ms cubic-bezier(0.16,1,0.3,1) ${index * 100}ms`,
              }}
            />
          </div>
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 13,
              fontWeight: 600,
              color: HZ.text,
              minWidth: 32,
              textAlign: 'right',
            }}
          >
            {comp.threatScore}
          </span>
          <span
            style={{
              display: 'inline-flex',
              color: HZ.muted,
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.25s ease',
            }}
          >
            <ChevronIcon open={open} />
          </span>
        </div>
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10,
            color: HZ.muted,
            marginTop: 6,
            paddingLeft: 0,
          }}
        >
          {narrative}
        </div>
        {mmBlock && <MarketMoveBlock mm={mmBlock} />}
      </div>

      {open && (
        <div
          style={{
            padding: '10px 6px 14px',
            fontFamily: FONT_MONO,
            fontSize: 11,
            animation: 'srpRowFade 280ms cubic-bezier(0.16,1,0.3,1) both',
          }}
        >
          <div style={{ color: '#ffffff', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 6 }}>
            {comp.name.toUpperCase()} — {comp.blocksOnGaps} GAPS BLOCKED
          </div>
          {blockedGaps.length === 0 ? (
            <div style={{ color: HZ.muted, paddingLeft: 2 }}>
              └ No blocked gaps in this scan.
            </div>
          ) : (
            blockedGaps.slice(0, 6).map((g, i) => (
              <div key={i} style={{ color: HZ.muted, paddingLeft: 2, marginTop: 3 }}>
                └ <SiteLink domain={g.domain} path={g.path}>{gapUrl(g)}</SiteLink> — {g.tier}, {normaliseGeo(g.country)}, {intentFor(g)}
              </div>
            ))
          )}
          {topGap && (
            <div
              style={{
                marginTop: 10,
                color: HZ.text,
                fontFamily: FONT_BODY,
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              {comp.name} is your primary blocker in {topGap.tier}{' '}
              {normaliseGeo(topGap.country)}. Closing {topGap.domain} removes their exclusive
              advantage on {normaliseGeo(topGap.country)} {intentFor(topGap)} traffic.
            </div>
          )}
          <BattlePlan comp={comp} gaps={blockedGaps} onDraft={onDraft} />
        </div>
      )}
    </div>
  )
}

// ─── §2 Market map ──────────────────────────────────────────────────────────────
function FieldMap({ matrix, onGapCell }) {
  return (
    <div
      style={{
        background: HZ.surface,
        border: `1px solid ${HZ.border}`,
        borderRadius: 6,
        padding: '14px 16px',
      }}
    >
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 10,
          color: HZ.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          fontWeight: 600,
        }}
      >
        Market Map — Who Owns What
      </div>
      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: 11,
          color: HZ.muted,
          marginTop: 4,
          marginBottom: 14,
        }}
      >
        Bybit presence highlighted. Empty cells = active gaps.
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `48px repeat(${GEOS.length}, 1fr)`,
          gap: 8,
        }}
      >
        <div />
        {GEOS.map((geo) => (
          <div
            key={geo}
            style={{
              fontFamily: FONT_MONO,
              fontSize: 10,
              color: HZ.muted,
              textAlign: 'center',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              paddingBottom: 2,
            }}
          >
            {geo}
          </div>
        ))}
        {TIERS.map((tier) => (
          <FieldMapTierRow key={tier} tier={tier} matrix={matrix} onGapCell={onGapCell} />
        ))}
      </div>
    </div>
  )
}

function FieldMapTierRow({ tier, matrix, onGapCell }) {
  return (
    <>
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 11,
          fontWeight: 700,
          color: HZ.text,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {tier}
      </div>
      {GEOS.map((geo) => {
        const cell = matrix[tier][geo]
        const isGap = cell.state === 'gap'
        const isBybit = cell.state === 'bybit'
        const clickable = isGap && cell.gap
        return (
          <div
            key={geo}
            onClick={clickable ? () => onGapCell(cell.gap) : undefined}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            onKeyDown={
              clickable
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onGapCell(cell.gap)
                    }
                  }
                : undefined
            }
            title={clickable ? 'Jump to this gap below' : undefined}
            style={{
              minHeight: 46,
              borderRadius: 5,
              padding: '8px 6px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
              alignItems: 'center',
              justifyContent: 'center',
              cursor: clickable ? 'pointer' : 'default',
              background: isBybit ? 'rgba(148,200,100,0.06)' : 'rgba(255,255,255,0.015)',
              border: isGap
                ? '1px dashed rgba(255,255,255,0.18)'
                : isBybit
                  ? '1px solid rgba(148,200,100,0.3)'
                  : `1px solid ${HZ.border}`,
            }}
          >
            {isBybit ? (
              <CompChip lime name="Bybit" />
            ) : (
              cell.comps.map((c) => (
                <CompChip
                  key={c}
                  name={c}
                  count={cell.counts[c]}
                  tier={tier}
                  geo={geo}
                />
              ))
            )}
          </div>
        )
      })}
    </>
  )
}

// ─── §5 Activation plan derivation ─────────────────────────────────────────────
function actionLabel(gap) {
  if (gap.tier === 'T1' && closabilityFor(gap) < 0.85) return 'Contact via press page'
  if (gap.tier === 'T3') return 'Community submission'
  return 'Submit listing'
}

function whyLine(gap) {
  if (gap.description) return gap.description.replace(/^Bybit absent\s*[—-]\s*/i, '').trim() || gap.description
  const c = competitorsForGap(gap)[0]
  return `${c} currently listed, Bybit absent`
}

function buildActivationPlan(sortedByOpp, currentScore) {
  const used = new Set()
  const take = (pred, n) => {
    const out = []
    for (const g of sortedByOpp) {
      if (out.length >= n) break
      if (used.has(gapSlug(g))) continue
      if (pred(g)) {
        used.add(gapSlug(g))
        out.push(g)
      }
    }
    return out
  }
  const isFastWin = (g) => g.tier !== 'T1' || closabilityFor(g) >= 0.85
  const week1 = take(isFastWin, 2)
  const week23 = take(() => true, 3)
  const week4 = take((g) => g.tier === 'T1' && closabilityFor(g) < 0.85, 2)
  const planGaps = [...week1, ...week23, ...week4]
  const points = planGaps.reduce((s, g) => s + (TIER_POINTS[g.tier] ?? 1), 0)
  return {
    week1,
    week23,
    week4,
    fromScore: currentScore,
    toScore: Math.min(100, currentScore + points),
  }
}

// ─── §6 CMO brief assembly ─────────────────────────────────────────────────────
function topCompetitorGeo(name, gapsByCompetitor) {
  const gs = gapsByCompetitor[name] || []
  const counts = {}
  gs.forEach((g) => {
    const geo = normaliseGeo(g.country)
    counts[geo] = (counts[geo] || 0) + 1
  })
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'EU'
}

function buildCmoBrief({ scanData, sortedByOpp, topComp, topMomentum, gapsByCompetitor, projection, scoreDelta, mode }) {
  const isInternal = mode === 'internal'
  const date = new Date(scanData.scannedAt || Date.now())
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    .toUpperCase()
  const gapsCount = scanData.gaps.length
  const high = scanData.gaps.filter((g) => g.severity === 'high').length
  const dir = scoreDelta >= 0 ? 'up' : 'down'
  const topGap = sortedByOpp[0]
  const geo = topComp ? topCompetitorGeo(topComp.name, gapsByCompetitor) : 'EU'
  const oppTag = (g) => (isInternal && g ? ` (OPP ${g._opp ?? oppScore(g)})` : '')

  const sections = [
    {
      h: 'HEADLINE',
      p: `EU presence score is ${scanData.score ?? 0}%, ${dir} ${Math.abs(scoreDelta)} point${
        Math.abs(scoreDelta) === 1 ? '' : 's'
      } since last scan. ${gapsCount} gaps identified, ${high} high priority.`,
    },
    {
      h: isInternal ? 'COMPETITIVE THREAT' : 'COMPETITIVE LANDSCAPE',
      p: topComp
        ? isInternal
          ? `${topComp.name} is accelerating — ${Math.max(
              1,
              topMomentum.delta
            )} new T1 listing${topMomentum.delta === 1 ? '' : 's'} this scan. Primary exposure in the ${geo} market.`
          : `${topComp.name} maintains a notable presence, with recent activity in the ${geo} market.`
        : 'Competitor field is stable this scan.',
    },
    {
      h: 'RECOMMENDED ACTION',
      p: topGap
        ? `${isInternal ? 'Immediate priority' : 'Suggested next step'}: ${gapUrl(topGap)}${oppTag(
            topGap
          )}. ${whyLine(topGap)}. Estimated score impact: +${TIER_POINTS[topGap.tier] ?? 1} points.`
        : 'No outstanding high-impact gaps this scan.',
    },
    {
      h: '30-DAY OUTLOOK',
      p: isInternal
        ? `Executing the top 3 closures moves presence score from ${projection.fromScore}% to ${
            projection.projected
          }%. ${topComp ? `${topComp.name}'s advantage in T1 ${geo} is closeable within this window.` : ''}`
        : `Executing the priority closures is projected to move presence score from ${projection.fromScore}% to ${projection.projected}% within 30 days.`,
    },
  ]
  const title = `${date} PRESENCE REPORT — BYBIT EU`
  const plain =
    `${title}\n\n` + sections.map((s) => `${s.h}\n${s.p}`).join('\n\n')
  return { title, sections, plain }
}

// ─── §3 Score projection dropdown ──────────────────────────────────────────────
function ScoreProjectionPanel({ projection }) {
  return (
    <div
      style={{
        margin: '0 24px 16px',
        background: HZ.surface,
        border: `1px solid ${HZ.border}`,
        borderRadius: 6,
        padding: '14px 18px',
        fontFamily: FONT_MONO,
        fontSize: 12,
        lineHeight: 1.6,
        animation: 'srpRowFade 280ms cubic-bezier(0.16,1,0.3,1) both',
      }}
    >
      {projection.top3.map((g, i) => (
        <div key={i} style={{ color: HZ.text, marginBottom: 4 }}>
          <span style={{ color: HZ.muted }}>GAP {i + 1} — </span>
          <SiteLink domain={g.domain} path={g.path}>{gapUrl(g)}</SiteLink>{' '}
          <span style={{ color: oppColor(g._opp ?? oppScore(g)) }}>
            (OPP {g._opp ?? oppScore(g)})
          </span>{' '}
          <span style={{ color: HZ.teal }}>→ +{TIER_POINTS[g.tier] ?? 1}pts</span>
        </div>
      ))}
      <div style={{ borderTop: `1px solid ${HZ.border}`, margin: '10px 0' }} />
      <div style={{ color: '#94c864', fontWeight: 700 }}>
        PROJECTED SCORE: {projection.projected}%
      </div>
      <div style={{ color: HZ.muted, marginTop: 2 }}>ESTIMATED TIMELINE: 30 days</div>
    </div>
  )
}

// ─── §5 Build-plan slide-down panel ────────────────────────────────────────────
function PlanItem({ gap, onDraft }) {
  const [hover, setHover] = useState(false)
  const opp = gap._opp ?? oppScore(gap)
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ color: HZ.text }}>
        <span style={{ color: HZ.teal }}>→ </span>
        <SiteLink domain={gap.domain} path={gap.path}>{gapUrl(gap)}</SiteLink> <span style={{ color: HZ.muted }}>— {whyLine(gap)}</span>{' '}
        <span style={{ color: oppColor(opp), fontWeight: 700 }}>(OPP {opp})</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, paddingLeft: 14 }}>
        <span style={{ color: HZ.muted, fontSize: 11 }}>{actionLabel(gap)}</span>
        <button
          onClick={() => onDraft(gap)}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.06em',
            padding: '3px 9px',
            borderRadius: 3,
            cursor: 'pointer',
            background: hover ? 'rgba(0,212,232,0.16)' : 'transparent',
            color: HZ.teal,
            border: '1px solid rgba(0,212,232,0.4)',
            transition: 'background 0.15s',
          }}
        >
          DRAFT OUTREACH
        </button>
      </div>
    </div>
  )
}

function PlanWeek({ title, blurb, gaps, onDraft }) {
  if (!gaps.length) return null
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ color: '#ffffff', fontWeight: 700, letterSpacing: '0.06em' }}>{title}</div>
      {blurb && (
        <div style={{ color: HZ.muted, fontSize: 11, margin: '2px 0 8px' }}>{blurb}</div>
      )}
      {gaps.map((g, i) => (
        <PlanItem key={i} gap={g} onDraft={onDraft} />
      ))}
    </div>
  )
}

function BuildPlanPanel({ open, plan, onClose, onDraft }) {
  return (
    <div
      style={{
        maxHeight: open ? 1400 : 0,
        opacity: open ? 1 : 0,
        overflow: 'hidden',
        borderBottom: open ? `1px solid ${HZ.border}` : '1px solid transparent',
        transition:
          'max-height 0.45s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease, border-color 0.3s ease',
      }}
      aria-hidden={!open}
    >
      <div style={{ padding: '18px 24px' }}>
        <div
          style={{
            background: HZ.surface,
            border: `1px solid ${HZ.border}`,
            borderRadius: 6,
            padding: '18px 20px',
            fontFamily: FONT_MONO,
            fontSize: 12,
            lineHeight: 1.6,
            position: 'relative',
          }}
        >
          <button
            onClick={onClose}
            style={{ ...closeBtnStyle, position: 'absolute', top: 10, right: 10 }}
            aria-label="Close build plan"
          >
            ✕
          </button>
          <div
            style={{
              color: HZ.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              fontSize: 11,
              marginBottom: 16,
            }}
          >
            30-Day Activation Plan
          </div>
          <PlanWeek
            title="WEEK 1 — CLOSE FAST WINS"
            blurb="Highest-OPP gaps that close quickly."
            gaps={plan.week1}
            onDraft={onDraft}
          />
          <PlanWeek
            title="WEEK 2–3 — ATTACK MID TIER"
            blurb="Next highest-opportunity targets."
            gaps={plan.week23}
            onDraft={onDraft}
          />
          <PlanWeek
            title="WEEK 4 — STRATEGIC PLAY"
            blurb="High-value T1 editorial — long lead time, so start the conversation now."
            gaps={plan.week4}
            onDraft={onDraft}
          />
          <div style={{ borderTop: `1px solid ${HZ.border}`, margin: '8px 0 12px' }} />
          <div style={{ color: '#94c864', fontWeight: 700 }}>
            IF EXECUTED: score moves {plan.fromScore}% → {plan.toScore}% in 30 days.
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── §6 CMO brief slide-in panel ───────────────────────────────────────────────
function CmoBriefPanel({ open, brief, mode, setMode, onClose, onCopy, copied }) {
  const tabBtn = (id, label) => (
    <button
      onClick={() => setMode(id)}
      style={{
        fontFamily: FONT_MONO,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.06em',
        padding: '5px 12px',
        borderRadius: 3,
        cursor: 'pointer',
        background: mode === id ? 'rgba(0,212,232,0.14)' : 'transparent',
        color: mode === id ? HZ.teal : HZ.muted,
        border: `1px solid ${mode === id ? 'rgba(0,212,232,0.4)' : HZ.border}`,
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.3s ease',
          zIndex: 120,
        }}
        aria-hidden={!open}
      />
      <aside
        aria-hidden={!open}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: 'min(650px, 100vw)',
          background: '#0d1320',
          borderLeft: '1px solid rgba(148,200,100,0.18)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1)',
          zIndex: 121,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            flexShrink: 0,
            padding: '18px 22px',
            borderBottom: `1px solid ${HZ.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontFamily: FONT_MONO,
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: '0.1em',
              color: '#94c864',
              textTransform: 'uppercase',
            }}
          >
            CMO Brief
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {tabBtn('internal', 'INTERNAL')}
            {tabBtn('client', 'CLIENT-READY')}
            <button onClick={onClose} style={closeBtnStyle} aria-label="Close brief">
              ✕
            </button>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 26px',
            fontFamily: FONT_BODY,
            color: HZ.text,
          }}
        >
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: '0.04em',
              marginBottom: 22,
            }}
          >
            {brief.title}
          </div>
          {brief.sections.map((s) => (
            <div key={s.h} style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  color: '#94c864',
                  marginBottom: 6,
                }}
              >
                {s.h}
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.65, color: '#c8d0dc' }}>{s.p}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            flexShrink: 0,
            borderTop: `1px solid ${HZ.border}`,
            padding: '14px 22px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <button
            onClick={onCopy}
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.06em',
              padding: '8px 16px',
              borderRadius: 4,
              cursor: 'pointer',
              background: '#94c864',
              color: '#0b1f0b',
              border: 'none',
            }}
          >
            COPY
          </button>
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              color: '#94c864',
              opacity: copied ? 1 : 0,
              transition: 'opacity 0.2s ease',
            }}
          >
            Copied to clipboard
          </span>
        </div>
      </aside>
    </>
  )
}

function GapRow({ gap, index, highlighted, isOpen, onToggle, onAskIntel }) {
  const [hover, setHover] = useState(false)
  const mailtoHref = buildOutreachMailto(gap)
  const opp = gap._opp ?? oppScore(gap)
  const comps = competitorsForGap(gap)
  const geo = normaliseGeo(gap.country)
  const site = gapUrl(gap)
  const clos = closabilityFor(gap)
  const closLabel = clos >= 0.85 ? 'HIGH' : clos >= 0.6 ? 'MED' : 'LOW'
  const closColor = clos >= 0.85 ? '#94c864' : clos >= 0.6 ? '#f59e0b' : '#00d4e8'

  const stop = (e) => e.stopPropagation()

  const askIntel = (e) => {
    e.stopPropagation()
    onAskIntel?.(
      `User is looking at a priority gap: ${site}, ${geo}, ${gap.tier}, competitors: ${
        comps.join(', ') || 'none'
      }. Surface the most actionable intelligence about closing this gap.`,
      intelKit.gap({ site, geo, tier: gap.tier, comps }),
    )
  }

  return (
    <div
      id={`gap-row-${gapSlug(gap)}`}
      style={{
        borderBottom: `1px solid ${HZ.border}`,
        animation: highlighted
          ? 'srpGapPulse 0.5s ease-out 1'
          : `srpRowFade 380ms cubic-bezier(0.16,1,0.3,1) ${index * 50}ms both`,
      }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle()
          }
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) auto auto auto auto auto',
          alignItems: 'center',
          gap: 12,
          padding: '10px 12px',
          cursor: 'pointer',
          userSelect: 'none',
          background: hover || isOpen ? HZ.elevated : 'transparent',
          transition: 'background 0.15s',
        }}
      >
        <div style={{ minWidth: 0, overflow: 'hidden' }}>
          <div
            style={{
              fontFamily: FONT_BODY,
              fontSize: 13,
              fontWeight: 500,
              color: HZ.text,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {gap.unverified && (
              <span
                title="Automated check unavailable — verify manually or ask C0insiglieri"
                style={{ color: HZ.amber, marginRight: 6, cursor: 'help' }}
              >
                ⚠
              </span>
            )}
            <SiteLink domain={gap.domain} path={gap.path}>{gap.domain}<span style={{ color: HZ.muted }}>{gap.path}</span></SiteLink>
          </div>
          {gap.description && (
            <div
              style={{
                fontFamily: FONT_BODY,
                fontSize: 11,
                color: HZ.muted,
                marginTop: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {gap.description}
            </div>
          )}
        </div>
        <OppBadge opp={opp} />
        <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: HZ.muted, minWidth: 60 }}>
          {gap.country}
        </span>
        <TierBadge tier={gap.tier} />
        <a
          href={mailtoHref}
          onClick={stop}
          title="Draft outreach"
          aria-label={`Draft outreach to ${gap.domain}`}
          style={{
            fontFamily: FONT_MONO,
            fontSize: 13,
            color: HZ.muted,
            textDecoration: 'none',
            padding: '0 4px',
            opacity: 0.5,
            transition: 'opacity 0.15s, color 0.15s',
            lineHeight: 1,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = HZ.teal }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.color = HZ.muted }}
        >
          ✉
        </a>
        <span
          style={{
            display: 'inline-flex',
            color: HZ.muted,
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.25s ease',
          }}
        >
          <ChevronIcon open={isOpen} />
        </span>
      </div>

      {/* Inline expansion */}
      <div
        style={{
          maxHeight: isOpen ? 560 : 0,
          opacity: isOpen ? 1 : 0,
          overflow: 'hidden',
          transition:
            'max-height 0.4s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease',
        }}
        aria-hidden={!isOpen}
      >
        <div
          style={{
            padding: '14px 14px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            background: 'rgba(255,255,255,0.015)',
          }}
        >
          {/* Row 1 — metrics strip */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 18,
              fontFamily: FONT_MONO,
              fontSize: 11,
              color: HZ.muted,
              letterSpacing: '0.06em',
            }}
          >
            <span>
              OPP{' '}
              <span style={{ color: oppColor(opp), fontWeight: 700, fontSize: 13 }}>{opp}</span>
            </span>
            <span style={{ color: HZ.border }}>·</span>
            <span>
              COMPETITORS:{' '}
              <span style={{ color: HZ.text, fontWeight: 700 }}>{comps.length}</span>
            </span>
            <span style={{ color: HZ.border }}>·</span>
            <span>
              CLOSABILITY:{' '}
              <span style={{ color: closColor, fontWeight: 700 }}>{closLabel}</span>
            </span>
          </div>

          {/* Row 2 — why this gap */}
          <div>
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 10,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: HZ.muted,
                marginBottom: 6,
              }}
            >
              Why this gap
            </div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 13, lineHeight: 1.6, color: '#c8d0dc' }}>
              Sites in {gap.tier} / {geo} carry high editorial authority — a listing here is a
              compounding ranking signal. Competitors know this, which is why{' '}
              {comps.slice(0, 2).join(' and ') || 'rivals'}
              {comps.length ? ' already appear here' : ' are circling'}.
            </div>
          </div>

          {/* Row 3 — competitors present */}
          <div>
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 10,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: HZ.muted,
                marginBottom: 8,
              }}
            >
              Competitors present
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {comps.length === 0 ? (
                <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: HZ.muted }}>
                  None detected — open field.
                </span>
              ) : (
                comps.map((c) => {
                  const m = competitorMeta(c)
                  return (
                    <span
                      key={c}
                      style={{
                        fontFamily: FONT_MONO,
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 3,
                        background: `${m.color}22`,
                        color: m.color,
                        border: `1px solid ${m.color}55`,
                        letterSpacing: '0.04em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c} {gap.tier}
                    </span>
                  )
                })
              )}
            </div>
          </div>

          {/* Row 4 — action strip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              paddingTop: 12,
              borderTop: `1px solid ${HZ.border}`,
            }}
          >
            <a
              href={mailtoHref}
              onClick={stop}
              style={{
                fontFamily: FONT_MONO,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                padding: '8px 14px',
                borderRadius: 4,
                cursor: 'pointer',
                background: 'transparent',
                color: HZ.teal,
                border: `1px solid rgba(0,212,232,0.4)`,
                textDecoration: 'none',
              }}
            >
              DRAFT OUTREACH
            </a>
            <AskIntelButton onClick={askIntel} />
          </div>
        </div>
      </div>
    </div>
  )
}

const closeBtnStyle = {
  background: 'transparent',
  border: 'none',
  color: HZ.muted,
  fontFamily: FONT_MONO,
  fontSize: 14,
  cursor: 'pointer',
  padding: '4px 8px',
  lineHeight: 1,
}

// ─── Main component ───────────────────────────────────────────────────────────

const ScanResultsPanel = forwardRef(function ScanResultsPanel(
  { visible, scanData, marketMoves, onClose, onDraftOutreach, onAskIntel },
  ref
) {
  // Latest real news headline per competitor (Section 9). Seeded narrative
  // is used only when there is no real move for that competitor.
  const movesByComp = useMemo(() => {
    const m = {}
    for (const mv of marketMoves || []) {
      if (mv && mv.competitor && !m[mv.competitor]) m[mv.competitor] = mv
    }
    return m
  }, [marketMoves])
  const [expanded, setExpanded] = useState(false)
  // Which Priority Gap card is expanded inline (one at a time).
  const [expandedGap, setExpandedGap] = useState(null)
  // "vs last scan" expandable diff row.
  const [diffOpen, setDiffOpen] = useState(false)
  // Per-section collapse state for the expanded diff panel. Empty map = every
  // section open (DiffSection treats `!== false` as open), so clearing this
  // re-expands all sections on each panel open.
  const [sectionsOpen, setSectionsOpen] = useState({})
  // Tabbed diff layout — pill strip across the top, one pane below. Default
  // is picked by data presence (gaps → competitors → wins → alerts → score)
  // on first open; user picks override.
  const [diffTab, setDiffTab] = useState(null)
  const diffTabInitedRef = useRef(false)
  const [barHover, setBarHover] = useState(false)
  const [prevSnapshot, setPrevSnapshot] = useState(null)
  // Intelligence layer UI state.
  const [projOpen, setProjOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const [briefOpen, setBriefOpen] = useState(false)
  const [briefMode, setBriefMode] = useState('internal')
  const [copied, setCopied] = useState(false)
  const [highlightGapId, setHighlightGapId] = useState(null)
  // Bumped each time the panel transitions visible:false → true. Used as a key
  // on row containers so CSS row-fade animations re-run on every reopen.
  const [openCount, setOpenCount] = useState(0)
  const wasVisibleRef = useRef(false)

  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      setOpenCount((c) => c + 1)
      setDiffOpen(false)
      setSectionsOpen({}) // all sections expanded by default on each open
      // Re-pick the default diff tab from scratch on every panel reopen so a
      // fresh scan that flips counts surfaces the right tab.
      diffTabInitedRef.current = false
      setDiffTab(null)
      // Scan completion: capture the previously-stored snapshot to diff against,
      // then persist the current results for the next scan. Seed a synthetic
      // prior scan if none exists so the diff is never blank (req e).
      if (scanData) {
        let prev = null
        try {
          const raw = localStorage.getItem(SNAPSHOT_KEY)
          if (raw) prev = JSON.parse(raw)
        } catch {
          prev = null
        }
        if (!prev) prev = seedPriorSnapshot(scanData)
        setPrevSnapshot(prev)
        try {
          localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(buildSnapshot(scanData, prev)))
        } catch {
          /* localStorage unavailable — diff still works in-memory this session */
        }
      }
    }
    if (!visible) {
      setExpanded(false)
      setDiffOpen(false)
      setSectionsOpen({})
      setProjOpen(false)
      setPlanOpen(false)
      setBriefOpen(false)
    }
    wasVisibleRef.current = visible
  }, [visible, scanData])

  // §2f — jump to a gap row from a field-map cell and pulse it briefly.
  const jumpToGap = (gap) => {
    setExpanded(true) // ensure the target row is rendered
    const id = `gap-row-${gapSlug(gap)}`
    setHighlightGapId(id)
    requestAnimationFrame(() =>
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 70)
    )
    setTimeout(() => setHighlightGapId(null), 800)
  }

  // §5d / §6e — open the existing INTEL panel primed with an outreach prompt.
  const draftOutreach = (gap) => {
    onDraftOutreach?.(outreachPrompt(gap))
  }

  const scanDiff = useMemo(
    () =>
      scanData
        ? buildDiffSections(scanData, prevSnapshot)
        : { hasPrevious: false, scoreDelta: 0, gapsDelta: 0, winsDelta: 0, alertsDelta: 0, sections: [] },
    [scanData, prevSnapshot]
  )

  // Lookup map (id → section) so the tabbed pane can pull specific sections
  // without iterating.
  const diffSectionsById = useMemo(
    () =>
      Object.fromEntries((scanDiff.sections || []).map((s) => [s.id, s])),
    [scanDiff.sections],
  )

  // Tab counts. 'gaps' tab unions 'opened' + 'resolved'. Competitors uses
  // badge.value (moverCount — competitors that moved this scan), not total
  // competitor count.
  const diffTabCounts = useMemo(
    () => ({
      score: diffSectionsById.score?.rows?.length || 0,
      gaps:
        (diffSectionsById.opened?.rows?.length || 0) +
        (diffSectionsById.resolved?.rows?.length || 0),
      wins: diffSectionsById.wins?.rows?.length || 0,
      alerts: diffSectionsById.alerts?.rows?.length || 0,
      competitors: diffSectionsById.competitors?.badge?.value || 0,
    }),
    [diffSectionsById],
  )

  // Short summary string shown on the closed "vs last scan" bar so the user
  // sees what's inside before clicking.
  const diffSummaryBadge = useMemo(() => {
    const parts = []
    if (diffTabCounts.gaps > 0) parts.push(`+${diffTabCounts.gaps} gap${diffTabCounts.gaps === 1 ? '' : 's'}`)
    if (diffTabCounts.wins > 0) parts.push(`${diffTabCounts.wins} win${diffTabCounts.wins === 1 ? '' : 's'}`)
    if (diffTabCounts.alerts > 0) parts.push(`${diffTabCounts.alerts} alert${diffTabCounts.alerts === 1 ? '' : 's'}`)
    if (diffTabCounts.competitors > 0)
      parts.push(`${diffTabCounts.competitors} competitor move${diffTabCounts.competitors === 1 ? '' : 's'}`)
    return parts.join(' · ')
  }, [diffTabCounts])

  // Default-tab init: when scan data first arrives, pick the highest-priority
  // tab that has content. User selections override after that.
  useEffect(() => {
    if (diffTabInitedRef.current) return
    if (!scanDiff.hasPrevious) return
    diffTabInitedRef.current = true
    const priority = ['gaps', 'competitors', 'wins', 'alerts', 'score']
    const next = priority.find((t) => diffTabCounts[t] > 0) || 'gaps'
    setDiffTab(next)
  }, [scanDiff.hasPrevious, diffTabCounts])

  const errorState = visible && !scanData

  // Use a generous max-height so expanded gap lists never clip; the cubic-bezier
  // transition still feels smooth because the actual content sets its own height.
  const wrapperStyle = {
    width: '100%',
    maxHeight: visible ? 4200 : 0,
    opacity: visible ? 1 : 0,
    overflow: 'hidden',
    background: HZ.bg,
    borderTop: errorState
      ? '1px solid rgba(158,27,27,0.4)'
      : '1px solid rgba(0,212,232,0.15)',
    transition: 'max-height 0.5s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease',
  }

  if (errorState) {
    return (
      <div ref={ref} id="scan-results" style={wrapperStyle} aria-hidden={!visible}>
        <div
          style={{
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: FONT_MONO,
            fontSize: 11,
            color: HZ.muted,
            letterSpacing: '0.1em',
          }}
        >
          <span>● SCAN COMPLETE — DATA UNAVAILABLE</span>
          <button onClick={onClose} style={closeBtnStyle} aria-label="Close">
            ✕
          </button>
        </div>
      </div>
    )
  }

  if (!scanData) {
    // Not visible and no data — render the collapsed shell (no content) so
    // the slide-up animation has a stable element to transition against.
    return <div ref={ref} id="scan-results" style={wrapperStyle} aria-hidden="true" />
  }

  // §1 — attach OPP and sort gaps by opportunity, highest first.
  const gapsWithOpp = scanData.gaps.map((g) => ({ ...g, _opp: oppScore(g) }))
  const sortedGaps = [...gapsWithOpp].sort((a, b) => b._opp - a._opp)
  const visibleGaps = expanded ? sortedGaps : sortedGaps.slice(0, 6)
  const remainingGaps = Math.max(0, sortedGaps.length - 6)
  const unresolved = sortedGaps.filter(
    (g) => g.severity === 'high' || g.severity === 'medium'
  ).length

  const baseComps = [...scanData.competitors]
  // §5b — ensure spec'd market-move competitors render even when absent from
  // the live competitor set (e.g. WhiteBit, OKX in the demo). Equal visual
  // weight is preserved by CompetitorRow; only bar width differs.
  MARKET_MOVE_NAMES.forEach((n) => {
    if (!baseComps.some((c) => c.name === n))
      baseComps.push({ name: n, threatScore: 0, blocksOnGaps: 0 })
  })
  const sortedCompetitors = baseComps
    .sort((a, b) => b.threatScore - a.threatScore)
    .slice(0, 8)
  const maxThreatScore = sortedCompetitors[0]?.threatScore || 100

  // §2 — tier×geo market map. §4 — gaps grouped per competitor.
  const fieldMatrix = buildFieldMap(gapsWithOpp)
  const gapsByCompetitor = {}
  gapsWithOpp.forEach((g) =>
    competitorsForGap(g).forEach((c) => {
      ;(gapsByCompetitor[c] ||= []).push(g)
    })
  )
  Object.values(gapsByCompetitor).forEach((arr) => arr.sort((a, b) => b._opp - a._opp))

  // §3 — projection from top-3 OPP gaps. §5 — 30-day plan. §6 — CMO brief.
  const currentScore = scanData.score ?? 0
  const projection = { ...projectionFor(sortedGaps, currentScore), fromScore: currentScore }
  const plan = buildActivationPlan(sortedGaps, currentScore)
  const topComp = sortedCompetitors[0]
  const topMomentum = topComp
    ? momentumFor(topComp, prevSnapshot)
    : { delta: 0, glyph: '→', color: HZ.muted }
  const scoreDelta =
    scanData.scoreDelta != null ? scanData.scoreDelta : scanDiff.scoreDelta ?? 0
  const cmoBrief = buildCmoBrief({
    scanData,
    sortedByOpp: sortedGaps,
    topComp,
    topMomentum,
    gapsByCompetitor,
    projection,
    scoreDelta,
    mode: briefMode,
  })

  const handleCopyBrief = () => {
    const done = () => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(cmoBrief.plain).then(done).catch(done)
      } else {
        done()
      }
    } catch {
      done()
    }
  }

  return (
    <div ref={ref} id="scan-results" style={wrapperStyle} aria-hidden={!visible}>
      {/* ─── Section 1 — scan meta bar ─────────────────────────────────── */}
      <div
        style={{
          padding: '10px 24px',
          borderBottom: `1px solid ${HZ.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: FONT_MONO,
          fontSize: 11,
          color: HZ.muted,
          letterSpacing: '0.08em',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <PulseDot />
          <span>SCAN COMPLETE</span>
          <span style={{ color: HZ.border }}>·</span>
          <span>{formatScannedAt(scanData.scannedAt)}</span>
          <span style={{ color: HZ.border }}>·</span>
          <span
            title={
              (scanData._failed ?? 0) > 0
                ? `${scanData._failed} site(s) could not be auto-verified — last known result shown where available`
                : 'All tracked sites verified this scan'
            }
            style={{ color: (scanData._failed ?? 0) > 0 ? HZ.amber : HZ.muted }}
          >
            {scanData._verified ?? scanData.sitesChecked ?? 0} of{' '}
            {scanData._total ?? scanData.sitesMonitored ?? 0} sites verified
            {(scanData._failed ?? 0) > 0 ? ` · ⚠ ${scanData._failed}` : ''}
          </span>
          <span style={{ color: HZ.border }}>·</span>
          <span>{sortedGaps.length} GAPS FOUND</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onAskIntel && (
            <AskIntelButton
              onClick={() => {
                const tg = sortedGaps[0]
                const ctx = `You are reviewing the post-scan results. EU presence/threat score ${
                  scanData.score ?? 0
                }, ${sortedGaps.length} gaps found, top by OPP: ${
                  tg ? gapUrl(tg) : 'none'
                }.`
                onAskIntel(
                  ctx,
                  tg
                    ? intelKit.scan({
                        score: scanData.score ?? 0,
                        gapName: gapUrl(tg),
                        geo: normaliseGeo(tg.country),
                        tier: tg.tier,
                        comps: competitorsForGap(tg).length,
                      })
                    : intelKit.scan({
                        score: scanData.score ?? 0,
                        gapName: 'no open gaps',
                        geo: '—',
                        tier: '—',
                        comps: 0,
                      }),
                )
              }}
            />
          )}
          <button
            onClick={() => setBriefOpen(true)}
            style={{
              fontFamily: FONT_MONO,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              padding: '6px 13px',
              borderRadius: 4,
              cursor: 'pointer',
              background: '#94c864',
              color: '#0b1f0b',
              border: 'none',
            }}
          >
            CMO BRIEF
          </button>
          <button
            onClick={() => setPlanOpen((o) => !o)}
            style={{
              fontFamily: FONT_MONO,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              padding: '6px 13px',
              borderRadius: 4,
              cursor: 'pointer',
              background: 'transparent',
              color: HZ.teal,
              border: `1px solid ${HZ.teal}`,
            }}
          >
            BUILD PLAN
          </button>
          <button onClick={onClose} style={closeBtnStyle} aria-label="Close">
            ✕
          </button>
        </div>
      </div>

      {/* ─── §5 — 30-day activation plan (slide-down) ──────────────────── */}
      <BuildPlanPanel
        open={planOpen}
        plan={plan}
        onClose={() => setPlanOpen(false)}
        onDraft={draftOutreach}
      />

      {/* ─── Section 2 — stat cards row ────────────────────────────────── */}
      <div style={{ padding: '24px 24px 16px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
          }}
        >
          <StatCard
            label="EU Presence Score"
            value={scanData.score}
            suffix="%"
            valueColor={HZ.teal}
            isVisible={visible}
            deltaText={
              scanData.scoreDelta != null
                ? `${scanData.scoreDelta >= 0 ? '↑' : '↓'}${Math.abs(scanData.scoreDelta)}`
                : null
            }
            deltaColor={scanData.scoreDelta >= 0 ? HZ.teal : HZ.redText}
            footer={
              <div
                role="button"
                tabIndex={0}
                aria-expanded={projOpen}
                onClick={() => setProjOpen((o) => !o)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setProjOpen((o) => !o)
                  }
                }}
                style={{
                  marginTop: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  userSelect: 'none',
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#94c864',
                }}
              >
                <span>
                  Close top 3 gaps <span style={{ color: HZ.teal }}>→</span> {currentScore}%{' '}
                  <span style={{ color: HZ.teal }}>→</span> {projection.projected}%
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    color: HZ.muted,
                    transform: projOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.25s ease',
                  }}
                >
                  <ChevronIcon open={projOpen} />
                </span>
              </div>
            }
          />
          <StatCard
            label="Tier 1 Gaps"
            value={scanData.tier1Gaps}
            valueColor={scanData.tier1Gaps > 0 ? HZ.redText : HZ.text}
            isVisible={visible}
            deltaText={
              scanData.tier1GapsDelta != null
                ? `${scanData.tier1GapsDelta >= 0 ? '↑' : '↓'}${Math.abs(scanData.tier1GapsDelta)}`
                : null
            }
            // for gaps, lower is better — positive delta = worse → red
            deltaColor={scanData.tier1GapsDelta > 0 ? HZ.redText : HZ.teal}
          />
          <StatCard
            label="Wins This Scan"
            value={scanData.wins ?? 0}
            valueColor={HZ.teal}
            isVisible={visible}
          />
          <StatCard
            label="Coverage"
            value={scanData.coverage ?? 0}
            suffix="%"
            valueColor={HZ.text}
            isVisible={visible}
            withBar
            barPct={scanData.coverage ?? 0}
          />
        </div>
      </div>

      {/* ─── §3 — score projection dropdown (below the stat cards) ─────── */}
      {projOpen && <ScoreProjectionPanel projection={projection} />}

      {/* ─── §2 — market map (full width, directly above the gaps card) ── */}
      <div style={{ padding: '0 24px 20px' }}>
        <FieldMap matrix={fieldMatrix} onGapCell={jumpToGap} />
      </div>

      {/* ─── Section 3 — two-column grid (gaps left, competitors right) ── */}
      <div
        style={{
          padding: '0 24px 24px',
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr',
          gap: 24,
        }}
      >
        {/* Gaps */}
        <div
          style={{
            background: HZ.surface,
            border: `1px solid ${HZ.border}`,
            borderRadius: 6,
            padding: '14px 16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <span
              style={{
                fontFamily: FONT_BODY,
                fontSize: 10,
                color: HZ.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                fontWeight: 600,
              }}
            >
              Gaps Detected This Scan
            </span>
            {unresolved > 0 && (
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 3,
                  background: 'rgba(212,168,83,0.1)',
                  color: HZ.amber,
                  border: '1px solid rgba(212,168,83,0.2)',
                  letterSpacing: '0.05em',
                }}
              >
                {unresolved} UNRESOLVED
              </span>
            )}
          </div>

          {sortedGaps.length === 0 ? (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                fontFamily: FONT_BODY,
                fontSize: 13,
                color: HZ.muted,
              }}
            >
              <div style={{ fontSize: 24, color: HZ.teal, marginBottom: 6 }}>✓</div>
              No new gaps detected this scan
            </div>
          ) : (
            <>
              <div key={`gaps-${openCount}`}>
                {visibleGaps.map((gap, i) => {
                  const slug = gapSlug(gap)
                  return (
                    <GapRow
                      key={`${gap.domain}-${gap.path}-${i}`}
                      gap={gap}
                      index={i}
                      highlighted={highlightGapId === `gap-row-${slug}`}
                      isOpen={expandedGap === slug}
                      onToggle={() =>
                        setExpandedGap((prev) => (prev === slug ? null : slug))
                      }
                      onAskIntel={onAskIntel}
                    />
                  )
                })}
              </div>
              {!expanded && remainingGaps > 0 && (
                <button
                  onClick={() => setExpanded(true)}
                  style={{
                    marginTop: 8,
                    padding: '8px 12px',
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    fontFamily: FONT_MONO,
                    fontSize: 11,
                    color: HZ.teal,
                    cursor: 'pointer',
                    textAlign: 'center',
                    letterSpacing: '0.05em',
                  }}
                >
                  + {remainingGaps} more ↓
                </button>
              )}
            </>
          )}
        </div>

        {/* Competitors */}
        <div
          style={{
            background: HZ.surface,
            border: `1px solid ${HZ.border}`,
            borderRadius: 6,
            padding: '14px 16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <span
              style={{
                fontFamily: FONT_BODY,
                fontSize: 10,
                color: HZ.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                fontWeight: 600,
              }}
            >
              Competitor Activity
            </span>
          </div>
          {sortedCompetitors.length === 0 ? (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                fontFamily: FONT_BODY,
                fontSize: 13,
                color: HZ.muted,
              }}
            >
              No competitor data
            </div>
          ) : (
            <div>
              {sortedCompetitors.map((c, i) => (
                <CompetitorRow
                  key={c.name}
                  comp={c}
                  maxScore={maxThreatScore}
                  isVisible={visible}
                  index={i}
                  momentum={momentumFor(c, prevSnapshot)}
                  blockedGaps={gapsByCompetitor[c.name] || []}
                  realMove={movesByComp[c.name]}
                  onDraft={draftOutreach}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Section 4 — "vs last scan" expandable diff row ────────────── */}
      <div>
        {/* Inline diff panel — slides up directly above the bar */}
        <div
          style={{
            maxHeight: diffOpen ? 2600 : 0,
            opacity: diffOpen ? 1 : 0,
            overflow: 'hidden',
            borderTop: diffOpen ? `1px solid ${HZ.border}` : '1px solid transparent',
            transition:
              'max-height 0.45s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease, border-color 0.3s ease',
          }}
          aria-hidden={!diffOpen}
        >
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            {scanDiff.hasPrevious ? (
              (() => {
                const TABS = [
                  { id: 'score', label: 'SCORE' },
                  { id: 'gaps', label: 'GAPS' },
                  { id: 'wins', label: 'WINS' },
                  { id: 'alerts', label: 'ALERTS' },
                  { id: 'competitors', label: 'COMPETITORS' },
                ]
                const activeTab = diffTab || 'gaps'
                const tabPillStyle = (isActive) => ({
                  padding: '6px 14px',
                  fontSize: 11,
                  fontFamily: FONT_MONO,
                  letterSpacing: '0.08em',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--cyan)' : 'var(--text-muted)',
                  background: isActive ? 'rgba(0, 212, 232, 0.08)' : 'transparent',
                  border: isActive
                    ? '1px solid rgba(0,212,232,0.25)'
                    : '1px solid transparent',
                  borderRadius: 6,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                })
                const renderSection = (id) => {
                  const sec = diffSectionsById[id]
                  if (!sec) return null
                  return (
                    <DiffSection key={id} section={sec} staticOpen open onToggle={() => {}} />
                  )
                }
                return (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        gap: 4,
                        padding: '12px 16px 0',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        flexWrap: 'wrap',
                      }}
                    >
                      {TABS.map((tab) => {
                        const isActive = activeTab === tab.id
                        const count = diffTabCounts[tab.id] || 0
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setDiffTab(tab.id)}
                            style={tabPillStyle(isActive)}
                          >
                            {tab.label}
                            {count > 0 && (
                              <span
                                style={{
                                  fontSize: 10,
                                  background: isActive
                                    ? 'var(--cyan)'
                                    : 'rgba(255,255,255,0.15)',
                                  color: isActive ? '#0a0e1a' : 'var(--text-muted)',
                                  borderRadius: 10,
                                  padding: '1px 6px',
                                  fontWeight: 600,
                                }}
                              >
                                {count}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                    <div
                      style={{
                        padding: 16,
                        minHeight: 120,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 18,
                      }}
                    >
                      {activeTab === 'score' && renderSection('score')}
                      {activeTab === 'gaps' && (
                        <>
                          {renderSection('opened')}
                          {renderSection('resolved')}
                        </>
                      )}
                      {activeTab === 'wins' && renderSection('wins')}
                      {activeTab === 'alerts' && renderSection('alerts')}
                      {activeTab === 'competitors' && renderSection('competitors')}
                    </div>
                  </>
                )
              })()
            ) : (
              <div
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 10,
                  padding: '14px 16px',
                  margin: '16px 24px',
                  color: HZ.muted,
                }}
              >
                First scan — no previous data to compare.
              </div>
            )}
          </div>
        </div>

        {/* Clickable summary bar — bright section header with cyan accent.
            Shows summary badge ("+3 gaps · 1 win") while collapsed so the
            content inside is legible before clicking. */}
        <div
          role="button"
          tabIndex={0}
          aria-expanded={diffOpen}
          aria-label="Toggle diff vs last scan"
          onClick={() => setDiffOpen((o) => !o)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setDiffOpen((o) => !o)
            }
          }}
          onMouseEnter={() => setBarHover(true)}
          onMouseLeave={() => setBarHover(false)}
          style={{
            borderTop: `1px solid ${HZ.border}`,
            borderLeft: '3px solid var(--cyan)',
            padding: '14px 24px 14px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            cursor: 'pointer',
            background: barHover ? HZ.elevated : 'transparent',
            transition: 'background 0.15s',
            userSelect: 'none',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 11,
                fontFamily: FONT_MONO,
                letterSpacing: '0.12em',
                fontWeight: 600,
                color: '#c8d0dc',
                textTransform: 'uppercase',
              }}
            >
              VS LAST SCAN
            </span>
            {!diffOpen && diffSummaryBadge && (
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  fontFamily: FONT_MONO,
                  letterSpacing: '0.04em',
                }}
              >
                {diffSummaryBadge}
              </span>
            )}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {scanData.scoreDelta != null && (
              <DeltaChip label="SCORE" delta={scanData.scoreDelta} positiveIsGood />
            )}
            {scanData.tier1GapsDelta != null && (
              <DeltaChip label="GAPS" delta={scanData.tier1GapsDelta} positiveIsGood={false} />
            )}
            {scanData.winsDelta != null && (
              <DeltaChip label="WINS" delta={scanData.winsDelta} positiveIsGood />
            )}
            {scanData.alertsDelta != null && (
              <DeltaChip label="ALERTS" delta={scanData.alertsDelta} positiveIsGood={false} />
            )}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: 4,
                color: HZ.muted,
              }}
            >
              <ChevronIcon open={diffOpen} />
            </span>
          </div>
        </div>
      </div>

      {/* ─── §6 — CMO brief slide-in panel ─────────────────────────────── */}
      <CmoBriefPanel
        open={briefOpen}
        brief={cmoBrief}
        mode={briefMode}
        setMode={setBriefMode}
        onClose={() => setBriefOpen(false)}
        onCopy={handleCopyBrief}
        copied={copied}
      />

      <style>{`
        @keyframes srpPulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.25; }
        }
        @keyframes srpRowFade {
          0%   { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes srpGapPulse {
          0%   { background: rgba(0,212,232,0.28); box-shadow: inset 0 0 0 1px rgba(0,212,232,0.6); }
          100% { background: transparent;          box-shadow: inset 0 0 0 1px rgba(0,212,232,0); }
        }
      `}</style>
    </div>
  )
})

export default ScanResultsPanel
