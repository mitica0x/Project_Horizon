import { forwardRef, useEffect, useRef, useState } from 'react'

// ─── Design tokens (Horizon War Room) ─────────────────────────────────────────
const HZ = {
  bg:        '#060a10',
  surface:   '#0d1117',
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
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) auto auto auto',
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
  // Bumped each time the panel transitions visible:false → true. Used as a key
  // on row containers so CSS row-fade animations re-run on every reopen.
  const [openCount, setOpenCount] = useState(0)
  const wasVisibleRef = useRef(false)

  useEffect(() => {
    if (visible && !wasVisibleRef.current) setOpenCount((c) => c + 1)
    if (!visible) setExpanded(false)
    wasVisibleRef.current = visible
  }, [visible])

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

      {/* ─── Section 4 — delta summary row ─────────────────────────────── */}
      <div
        style={{
          borderTop: `1px solid ${HZ.border}`,
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
