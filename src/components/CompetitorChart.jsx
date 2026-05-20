import { useState } from 'react'
import { COMPETITORS, TABLE_DATA as SITE_TABLE_DATA, GAPS_T1, GAPS_T2 } from '../data/staticData'
import { computeThreatScore, buildHookSentence } from '../utils/threatScore'

// Relative-to-max threat colour: top 30% of the field reads red, mid (35–70%)
// amber, low (<35%) green. Mirrors the original ranking visual so the chart
// shows field shape, not absolute counts.
function getThreatColor(score, maxScore) {
  const pct = maxScore ? score / maxScore : 0
  if (pct >= 0.7) return '#ff4d6d'
  if (pct >= 0.35) return '#d4a853'
  return '#94c864'
}

export default function CompetitorChart({ onOpenPanel, liveCompetitors, liveCoverage }) {
  const [hoveredIndex, setHoveredIndex] = useState(null)

  const seededRanked = [...COMPETITORS]
    .map(c => {
      const td = computeThreatScore(c.name, SITE_TABLE_DATA, GAPS_T1, GAPS_T2)
      return { ...c, ...td, hook: buildHookSentence(td) }
    })
    .sort((a, b) => b.score - a.score)

  // Real competitor momentum (appearance counts across all scan rows, sorted
  // desc) when scan data exists; seeded threat ranking otherwise.
  const live = Array.isArray(liveCompetitors) && liveCompetitors.length > 0
  const ranked = live
    ? liveCompetitors.map(c => ({ name: c.name, score: c.count, tier: 2, hook: '' }))
    : seededRanked

  const maxScore = ranked[0]?.score || 1

  return (
    <div style={{
      background: '#131929',
      borderRadius: '12px',
      padding: '36px 40px 32px',
      fontFamily: "'Geist', sans-serif",
    }}>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{
          fontFamily: "'Geist', sans-serif",
          fontWeight: 700,
          fontSize: '12px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#ffffff',
          marginBottom: '4px',
        }}>
          Competitor Threat Ranking
        </div>
        <div style={{ fontSize: '13px', color: '#8892a4' }}>
          Ranked by threat score — signal strength = market presence weight
        </div>
      </div>

      {/* Rows — 2-up card grid. Each card: dot + name + score top row, then a
          4px relative-width bar below tinted by absolute threat threshold. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '6px 16px',
        }}
      >
        {ranked.map((comp, i) => {
          const threatColor = getThreatColor(comp.score, maxScore)
          const isHov = hoveredIndex === i
          const barPct = Math.min((comp.score / (maxScore || 1)) * 100, 100)
          return (
            <div
              key={comp.name}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => onOpenPanel && onOpenPanel({ ...comp, maxScore })}
              title={comp.hook || undefined}
              style={{
                background: 'var(--bg-card)',
                border: `1px solid ${isHov ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 8,
                padding: '10px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                cursor: 'pointer',
                transition: 'border-color 0.15s',
                minWidth: 0,
              }}
            >
              {/* Top row: dot + name + score */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    background: threatColor,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: "'Geist', sans-serif",
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#e8eaf0',
                    flex: 1,
                    minWidth: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {comp.name}
                </span>
                <span
                  style={{
                    fontFamily: "'Geist Mono', monospace",
                    fontSize: 14,
                    fontWeight: 700,
                    color: threatColor,
                    flexShrink: 0,
                  }}
                >
                  {comp.score}
                </span>
              </div>

              {/* Bar */}
              <div
                style={{
                  height: 4,
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${barPct}%`,
                    background: threatColor,
                    borderRadius: 2,
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Coverage footer */}
      <hr style={{
        border: 'none',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        margin: '22px 0',
      }} />
      <div style={{
        fontFamily: "'Geist', sans-serif",
        fontWeight: 700,
        fontSize: '11px',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: '#8892a4',
        marginBottom: '12px',
      }}>
        Coverage
      </div>
      <div style={{ display: 'flex', gap: '40px' }}>
        {[
          { label: 'Pages Present', value: liveCoverage ? liveCoverage.present : 13,        accent: '#00d4e8' },
          { label: 'Pages Tracked', value: liveCoverage ? liveCoverage.tracked : 25,        accent: '#ffffff' },
          { label: 'Coverage',      value: `${liveCoverage ? liveCoverage.pct : 52}%`,      accent: '#94c864' },
        ].map(({ label, value, accent }) => (
          <div key={label}>
            <div style={{
              fontFamily: "'Geist', sans-serif",
              fontSize: '13px',
              color: '#8892a4',
              marginBottom: '2px',
            }}>
              {label}
            </div>
            <div style={{
              fontFamily: "'Geist Mono', monospace",
              fontWeight: 600,
              fontSize: '24px',
              color: accent,
            }}>
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
