import { useEffect, useState } from 'react'
import { COMPETITORS, TABLE_DATA as SITE_TABLE_DATA, GAPS_T1, GAPS_T2 } from '../data/staticData'
import { computeThreatScore, buildHookSentence, getThreatColor } from '../utils/threatScore'

export default function CompetitorChart({ onOpenPanel }) {
  const [animated, setAnimated] = useState(false)
  const [hoveredIndex, setHoveredIndex] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 80)
    return () => clearTimeout(t)
  }, [])

  const ranked = [...COMPETITORS]
    .map(c => {
      const td = computeThreatScore(c.name, SITE_TABLE_DATA, GAPS_T1, GAPS_T2)
      return { ...c, ...td, hook: buildHookSentence(td) }
    })
    .sort((a, b) => b.score - a.score)

  const maxScore = ranked[0]?.score || 1

  return (
    <div style={{
      background: '#131929',
      borderRadius: '12px',
      padding: '36px 40px 32px',
      fontFamily: "'IBM Plex Sans', sans-serif",
    }}>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{
          fontFamily: "'Syne', sans-serif",
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

      {/* Rows */}
      <div>
        {ranked.map((comp, i) => {
          const color = getThreatColor(comp.score, maxScore)
          const isHov = hoveredIndex === i
          return (
            <div
              key={comp.name}
              style={{
                display: 'grid',
                gridTemplateColumns: '140px 1fr 48px',
                alignItems: 'center',
                gap: '0 12px',
                padding: '8px 0',
                cursor: 'pointer',
                borderRadius: '6px',
                background: isHov ? 'rgba(255,255,255,0.025)' : 'transparent',
                transition: 'background 0.2s',
              }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => onOpenPanel && onOpenPanel({ ...comp, maxScore })}
            >
              {/* Cell 1: Name pill */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                background: isHov ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)',
                border: '1px solid',
                borderColor: isHov && color ? color : 'rgba(255,255,255,0.06)',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'background 0.2s, border-color 0.2s',
                width: '100%',
                justifyContent: 'flex-end',
                boxSizing: 'border-box',
              }}>
                <span style={{
                  display: 'inline-block',
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: comp.tier === 1 ? '#B8FF00' : comp.tier === 2 ? '#00d4e8' : '#8892a4',
                }} />
                <span style={{
                  fontFamily: "'Syne', sans-serif",
                  fontWeight: 700,
                  fontSize: '16px',
                  color: isHov ? '#ffffff' : '#8892a4',
                  transition: 'color 0.2s',
                  whiteSpace: 'nowrap',
                }}>
                  {comp.name}
                </span>
              </div>

              {/* Cell 2: Bar track */}
              <div style={{
                height: '38px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '3px',
                position: 'relative',
                overflow: 'hidden',
              }}>
                {comp.score === 0 ? (
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    top: '18px',
                    bottom: 'auto',
                    height: '2px',
                    width: '0%',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: '3px',
                  }} />
                ) : (
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    borderRadius: '3px',
                    width: animated ? `${(comp.score / maxScore) * 100}%` : '0%',
                    background: `linear-gradient(to right, ${color}ee 0%, ${color}99 30%, ${color}33 70%, transparent 100%)`,
                    transition: 'width 0.9s cubic-bezier(0.16,1,0.3,1)',
                    transitionDelay: animated ? `${i * 45}ms` : '0ms',
                  }}>
                    <div style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: '4px',
                      borderRadius: '0 3px 3px 0',
                      background: color,
                      boxShadow: `0 0 10px ${color}, 0 0 20px ${color}88`,
                      opacity: isHov ? 1 : 0,
                      transition: 'opacity 0.2s',
                    }} />
                  </div>
                )}
              </div>

              {/* Cell 3: Score */}
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontWeight: 600,
                fontSize: '14px',
                color: comp.score > 0 ? '#ffffff' : '#8892a4',
                textAlign: 'right',
              }}>
                {comp.score}
              </div>

              {/* Hook sentence — spans cols 2–3, row 2 */}
              <div style={{
                gridColumn: '2 / 4',
                fontFamily: "'IBM Plex Mono', monospace",
                fontWeight: 400,
                fontSize: '11px',
                color: color || '#4a5568',
                paddingBottom: '4px',
                maxHeight: isHov && comp.hook ? '22px' : '0px',
                overflow: 'hidden',
                opacity: isHov && comp.hook ? 1 : 0,
                transition: 'max-height 0.25s ease, opacity 0.25s ease',
              }}>
                {comp.hook}
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
        fontFamily: "'Syne', sans-serif",
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
          { label: 'Pages Present', value: 13,    accent: '#00d4e8' },
          { label: 'Pages Tracked', value: 53,    accent: '#ffffff' },
          { label: 'Coverage',      value: '31%', accent: '#B8FF00' },
        ].map(({ label, value, accent }) => (
          <div key={label}>
            <div style={{
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: '13px',
              color: '#8892a4',
              marginBottom: '2px',
            }}>
              {label}
            </div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
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
