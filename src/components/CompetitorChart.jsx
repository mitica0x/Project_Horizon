import { useState } from 'react'
import { COMPETITORS, TABLE_DATA as SITE_TABLE_DATA, GAPS_T1, GAPS_T2 } from '../data/staticData'
import { computeThreatScore, buildHookSentence, getThreatColor } from '../utils/threatScore'

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

      {/* Rows — compact 2-up grid: dot + name + score per cell. Threat colour
          tints the score so the strongest competitors still read at a glance. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '6px 16px',
        }}
      >
        {ranked.map((comp, i) => {
          const color = getThreatColor(comp.score, maxScore)
          const isHov = hoveredIndex === i
          return (
            <div
              key={comp.name}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => onOpenPanel && onOpenPanel({ ...comp, maxScore })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                cursor: 'pointer',
                borderRadius: 6,
                border: `1px solid ${isHov && color ? color : 'rgba(255,255,255,0.06)'}`,
                background: isHov ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                transition: 'background 0.15s, border-color 0.15s',
                minWidth: 0,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: comp.tier === 1 ? '#94c864' : comp.tier === 2 ? '#00d4e8' : '#8892a4',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: "'Geist', sans-serif",
                  fontWeight: 600,
                  fontSize: 14,
                  color: isHov ? '#ffffff' : '#c8d0dc',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  flex: 1,
                  minWidth: 0,
                  transition: 'color 0.15s',
                }}
              >
                {comp.name}
              </span>
              <span
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontWeight: 700,
                  fontSize: 13,
                  color: comp.score > 0 ? (color || '#ffffff') : '#8892a4',
                  flexShrink: 0,
                }}
                title={comp.hook || undefined}
              >
                {comp.score}
              </span>
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
