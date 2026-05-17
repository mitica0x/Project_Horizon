import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { CONTACT_EMAIL } from '../config'

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

function buildSnapshot(scanData) {
  return {
    score: scanData.score ?? 0,
    tier1Gaps: scanData.tier1Gaps ?? 0,
    brandAlerts: scanData.brandAlerts ?? 0,
    wins: scanData.wins ?? 0,
    gaps: (scanData.gaps || []).map((g) => ({
      domain: g.domain,
      path: g.path,
      tier: g.tier,
      severity: g.severity,
    })),
    scannedAt: scanData.scannedAt || null,
  }
}

// (e) If no snapshot exists yet, synthesise a slightly-worse prior scan so the
// diff is never blank for the demo: score down 4, two extra (now-resolved)
// T1 gaps, one fewer win, alerts unchanged.
function seedPriorSnapshot(scanData) {
  const cs = buildSnapshot(scanData)
  return {
    ...cs,
    score: Math.max(0, cs.score - 4),
    tier1Gaps: cs.tier1Gaps + 2,
    wins: Math.max(0, cs.wins - 1),
    gaps: [
      ...cs.gaps,
      { domain: 'finder.com', path: '/uk/crypto', tier: 'T1', severity: 'high' },
      { domain: 'cryptoradar.de', path: '/best-exchanges-2024', tier: 'T1', severity: 'high' },
    ],
    scannedAt: null,
    __seeded: true,
  }
}

function pluralise(n, word) {
  return `${n} ${word}${Math.abs(n) === 1 ? '' : 's'}`
}

function computeScanDiff(scanData, prev) {
  if (!prev) return { hasPrevious: false, rows: [] }

  const curr = buildSnapshot(scanData)
  const prevKeys = new Set((prev.gaps || []).map(gapKey))
  const currKeys = new Set(curr.gaps.map(gapKey))
  const resolved = (prev.gaps || []).filter((g) => !currKeys.has(gapKey(g)))
  const opened = curr.gaps.filter((g) => !prevKeys.has(gapKey(g)))

  const scoreDelta = curr.score - prev.score
  const gapsDelta = curr.tier1Gaps - prev.tier1Gaps
  const winsDelta = curr.wins - prev.wins
  const alertsDelta = curr.brandAlerts - prev.brandAlerts

  // SCORE summary line
  const scoreBits = []
  if (resolved.length) scoreBits.push(pluralise(resolved.length, 'gap') + ' resolved')
  if (winsDelta > 0) scoreBits.push(pluralise(winsDelta, 'new win'))
  scoreBits.push(
    scoreDelta > 0 ? 'field pressure down' : scoreDelta < 0 ? 'field pressure up' : 'field pressure flat'
  )

  // GAPS lines
  const gapLines = []
  resolved.forEach((g) => {
    const url = `${g.domain}${g.path || ''}`
    gapLines.push(g.tier === 'T1' ? `${url} — T1 gap closed` : `${url} — resolved, Bybit now listed`)
  })
  opened.forEach((g) => {
    const url = `${g.domain}${g.path || ''}`
    gapLines.push(`${url} — new ${g.tier || 'T2'} gap detected`)
  })
  if (gapLines.length === 0) gapLines.push('No gap changes since last scan')

  // WINS lines — surface confirmed listings from resolved gaps
  const winLines = []
  if (winsDelta > 0) {
    const fromResolved = resolved.slice(0, winsDelta).map((g) => `${g.domain}${g.path || ''} — Bybit added`)
    winLines.push(...fromResolved)
    const remaining = winsDelta - fromResolved.length
    if (remaining > 0) winLines.push(`${pluralise(remaining, 'new listing')} confirmed`)
  } else if (winsDelta < 0) {
    winLines.push(`${pluralise(Math.abs(winsDelta), 'listing')} lost`)
  } else {
    winLines.push('No new wins since last scan')
  }

  // ALERTS line
  const alertLines = []
  if (alertsDelta === 0) alertLines.push('No new alerts since last scan')
  else if (alertsDelta > 0) alertLines.push(`${pluralise(alertsDelta, 'new alert')} raised`)
  else alertLines.push(`${pluralise(Math.abs(alertsDelta), 'alert')} cleared`)

  return {
    hasPrevious: true,
    rows: [
      { label: 'SCORE', delta: scoreDelta, good: scoreDelta > 0, lines: [scoreBits.join(', ')] },
      { label: 'GAPS', delta: gapsDelta, good: gapsDelta < 0, lines: gapLines },
      { label: 'WINS', delta: winsDelta, good: winsDelta > 0, lines: winLines },
      { label: 'ALERTS', delta: alertsDelta, good: alertsDelta < 0, lines: alertLines },
    ],
  }
}

function diffArrowColor(delta, good) {
  if (delta === 0) return HZ.teal // informational — cyan
  return good ? DIFF_LIME : DIFF_AMBER
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

// ─── Subcomponents ────────────────────────────────────────────────────────────

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

function CompetitorRow({ comp, maxScore, isVisible, index }) {
  const pct = maxScore > 0 ? (comp.threatScore / maxScore) * 100 : 0
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 0',
        borderBottom: `1px solid ${HZ.border}`,
      }}
    >
      <div style={{ minWidth: 110 }}>
        <div style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 500, color: HZ.text }}>
          {comp.name}
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 10, color: HZ.muted, marginTop: 2 }}>
          Blocks {comp.blocksOnGaps} gaps
        </div>
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
    </div>
  )
}

function GapRow({ gap, index }) {
  const [hover, setHover] = useState(false)
  const mailtoHref = buildOutreachMailto(gap)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) auto auto auto auto',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        background: hover ? HZ.elevated : 'transparent',
        borderBottom: `1px solid ${HZ.border}`,
        transition: 'background 0.15s',
        animation: `srpRowFade 380ms cubic-bezier(0.16,1,0.3,1) ${index * 50}ms both`,
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
          {gap.domain}
          <span style={{ color: HZ.muted }}>{gap.path}</span>
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
      <SeverityBadge severity={gap.severity} />
      <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: HZ.muted, minWidth: 60 }}>
        {gap.country}
      </span>
      <TierBadge tier={gap.tier} />
      <a
        href={mailtoHref}
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

const ScanResultsPanel = forwardRef(function ScanResultsPanel({ visible, scanData, onClose }, ref) {
  const [expanded, setExpanded] = useState(false)
  // "vs last scan" expandable diff row.
  const [diffOpen, setDiffOpen] = useState(false)
  const [barHover, setBarHover] = useState(false)
  const [prevSnapshot, setPrevSnapshot] = useState(null)
  // Bumped each time the panel transitions visible:false → true. Used as a key
  // on row containers so CSS row-fade animations re-run on every reopen.
  const [openCount, setOpenCount] = useState(0)
  const wasVisibleRef = useRef(false)

  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      setOpenCount((c) => c + 1)
      setDiffOpen(false)
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
          localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(buildSnapshot(scanData)))
        } catch {
          /* localStorage unavailable — diff still works in-memory this session */
        }
      }
    }
    if (!visible) {
      setExpanded(false)
      setDiffOpen(false)
    }
    wasVisibleRef.current = visible
  }, [visible, scanData])

  const scanDiff = useMemo(
    () => (scanData ? computeScanDiff(scanData, prevSnapshot) : { hasPrevious: false, rows: [] }),
    [scanData, prevSnapshot]
  )

  const errorState = visible && !scanData

  // Use a generous max-height so expanded gap lists never clip; the cubic-bezier
  // transition still feels smooth because the actual content sets its own height.
  const wrapperStyle = {
    width: '100%',
    maxHeight: visible ? 1800 : 0,
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

  const sortedGaps = [...scanData.gaps].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
  )
  const visibleGaps = expanded ? sortedGaps : sortedGaps.slice(0, 6)
  const remainingGaps = Math.max(0, sortedGaps.length - 6)
  const unresolved = sortedGaps.filter(
    (g) => g.severity === 'high' || g.severity === 'medium'
  ).length

  const sortedCompetitors = [...scanData.competitors]
    .sort((a, b) => b.threatScore - a.threatScore)
    .slice(0, 5)
  const maxThreatScore = sortedCompetitors[0]?.threatScore || 100

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
          <span>{scanData.sitesChecked ?? 0} SITES CHECKED</span>
          <span style={{ color: HZ.border }}>·</span>
          <span>{sortedGaps.length} GAPS FOUND</span>
        </div>
        <button onClick={onClose} style={closeBtnStyle} aria-label="Close">
          ✕
        </button>
      </div>

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
                {visibleGaps.map((gap, i) => (
                  <GapRow key={`${gap.domain}-${gap.path}-${i}`} gap={gap} index={i} />
                ))}
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
            maxHeight: diffOpen ? 640 : 0,
            opacity: diffOpen ? 1 : 0,
            overflow: 'hidden',
            borderTop: diffOpen ? `1px solid ${HZ.border}` : '1px solid transparent',
            transition:
              'max-height 0.4s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease, border-color 0.3s ease',
          }}
          aria-hidden={!diffOpen}
        >
          <div style={{ padding: '16px 24px' }}>
            <div
              style={{
                background: HZ.surface,
                border: `1px solid ${HZ.border}`,
                borderRadius: 6,
                padding: '16px 18px',
                fontFamily: FONT_MONO,
                fontSize: 12,
                lineHeight: 1.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              {scanDiff.hasPrevious ? (
                scanDiff.rows.map((row) => {
                  const arrow = row.delta > 0 ? '↑' : row.delta < 0 ? '↓' : '→'
                  const color = diffArrowColor(row.delta, row.good)
                  return (
                    <div key={row.label}>
                      <div style={{ letterSpacing: '0.06em' }}>
                        <span style={{ color: '#ffffff', fontWeight: 700 }}>{row.label}</span>{' '}
                        <span style={{ color, fontWeight: 700 }}>
                          {arrow}
                          {Math.abs(row.delta)}
                        </span>
                      </div>
                      {row.lines.map((line, i) => (
                        <div
                          key={i}
                          style={{ color: HZ.muted, paddingLeft: 2, marginTop: 4 }}
                        >
                          └ {line}
                        </div>
                      ))}
                    </div>
                  )
                })
              ) : (
                <div style={{ color: HZ.muted }}>
                  First scan — no previous data to compare.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Clickable summary bar */}
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
            padding: '14px 24px',
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
          <span
            style={{
              fontFamily: FONT_BODY,
              fontSize: 10,
              color: HZ.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
            }}
          >
            vs last scan
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

      <style>{`
        @keyframes srpPulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.25; }
        }
        @keyframes srpRowFade {
          0%   { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
})

export default ScanResultsPanel
