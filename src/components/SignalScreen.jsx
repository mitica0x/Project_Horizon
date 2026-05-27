import { useMemo } from 'react'
import { motion } from 'framer-motion'
import * as Tooltip from '@radix-ui/react-tooltip'
import {
  assessCompetitors,
  computeSignal,
  getDayStatus,
} from '../utils/horizonData'
import { GAPS_T1, TABLE_DATA } from '../data/staticData'
import { FONT_HEAD, FONT_MONO } from './horizonUI'

// SIGNAL screen — verdict-first composition. Replaces the deleted radar +
// duplicate-metric STATUS dashboard. The verdict IS the screen; HIGH PRESSURE
// is repositioned to the right column; N0VA pressure bar pinned bottom.

const EASE_SOFT = [0.22, 1, 0.36, 1]
const EASE_SPRING = [0.34, 1.56, 0.64, 1]

const VERDICT_PALETTE = {
  DEPLOY:   { color: '#0dbe82' },
  PREPARE:  { color: '#D4A853' }, // amber — Ax0n-reserved, used here per spec
  HOLD:     { color: '#71717a' },
  WAIT:     { color: '#71717a' },
  CRITICAL: { color: '#e8703a' },
}

function confidencePalette(pct) {
  if (pct > 80) return { color: '#0dbe82', rgb: '13,190,130' }
  if (pct >= 60) return { color: '#18b4d4', rgb: '24,180,212' }
  return { color: '#e8703a', rgb: '232,112,58' }
}

function threatPalette(pressure) {
  const p = Number(pressure) || 0
  if (p >= 85) return { level: 'CRITICAL', color: '#e8703a', rgb: '232,112,58' }
  if (p >= 70) return { level: 'HIGH',     color: '#e8703a', rgb: '232,112,58' }
  if (p >= 40) return { level: 'MEDIUM',   color: '#18b4d4', rgb: '24,180,212' }
  return { level: 'LOW', color: '#70a848', rgb: '112,168,72' }
}

// Per-row dot color for the HIGH PRESSURE rail (mirrors StatusBoard).
const SIGNAL_DOT = {
  'Competitor Activity': { color: '#c4612a', pulse: false },
  'Market Sentiment':    { color: '#e8703a', pulse: true  },
  'Regulatory Noise':    { color: '#0dbe82', pulse: false },
  'Upcoming Windows':    { color: '#18b4d4', pulse: false },
  'Brand Events':        { color: '#6ef5c4', pulse: false },
  'Team Execution':      { color: '#6ef5c4', pulse: false },
}

export default function SignalScreen({ scanData }) {
  const sig = useMemo(() => computeSignal(), [])
  const field = useMemo(() => assessCompetitors(), [])
  const { signals } = useMemo(() => getDayStatus(), [])

  const verdictKey = VERDICT_PALETTE[sig.verdict] ? sig.verdict : 'WAIT'
  const tone = VERDICT_PALETTE[verdictKey]
  const conf = confidencePalette(sig.confidence)
  const threat = threatPalette(field?.pressure)

  // Single-line stat strip — derive from live data; falls back to seeded
  // counts when no scan has run yet.
  const sites = scanData?.sitesMonitored ?? (TABLE_DATA?.length || 0)
  const t1Gaps = scanData?.tier1Gaps ?? (GAPS_T1?.length || 0)
  const uncontacted = (GAPS_T1 || []).filter(g => !g.contacted).length || t1Gaps

  return (
    <Tooltip.Provider delayDuration={150}>
      <div
        style={{
          // Full-width body inside .hz-shell — leaves room for the fixed N0VA
          // pressure bar (28px) + sidebar SCAN NOW area, plus standard gutters.
          padding: '24px 32px 48px',
          minHeight: 'calc(100vh - 44px - 28px)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '60% 40%',
            gap: 32,
            alignItems: 'start',
          }}
        >
          {/* ── LEFT (60%) — VERDICT + BADGES + STAT STRIP ──────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* SIGNAL VERDICT label */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE_SOFT }}
              style={{
                fontFamily: FONT_MONO,
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: '#71717a',
              }}
            >
              Signal verdict
            </motion.div>

            {/* VERDICT — 56px */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE_SOFT, delay: 0.04 }}
              style={{
                fontFamily: FONT_HEAD,
                fontSize: 56,
                fontWeight: 700,
                lineHeight: 1,
                color: tone.color,
                textShadow: `0 0 32px ${tone.color}40`,
              }}
            >
              {verdictKey}
            </motion.div>

            {/* BADGES — confidence + threat */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE_SOFT, delay: 0.1 }}
              style={{ display: 'flex', gap: 8, marginTop: 8 }}
            >
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  padding: '4px 10px',
                  borderRadius: 3,
                  color: '#18b4d4',
                  background: 'rgba(24,180,212,0.06)',
                  border: '0.5px solid rgba(24,180,212,0.5)',
                }}
              >
                CONFIDENCE: {sig.confidence}%
              </span>
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  padding: '4px 10px',
                  borderRadius: 3,
                  color: threat.color,
                  background: `rgba(${threat.rgb},0.06)`,
                  border: `0.5px solid rgba(${threat.rgb},0.5)`,
                }}
              >
                THREAT: {threat.level}
              </span>
            </motion.div>

            {/* STAT STRIP — single line with · separators, no boxes */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE_SOFT, delay: 0.16 }}
              style={{
                marginTop: 8,
                fontFamily: FONT_MONO,
                fontSize: 12,
                color: '#71717a',
                letterSpacing: '0.04em',
              }}
            >
              {sites} SITES <Sep /> {t1Gaps} T1 GAPS <Sep /> {uncontacted} UNCONTACTED <Sep /> 12ms LATENCY
            </motion.div>

            {/* Confidence/threat hint line — subtle context, not a card */}
            <div
              style={{
                marginTop: 18,
                fontFamily: FONT_MONO,
                fontSize: 11,
                color: '#3f3f46',
                letterSpacing: '0.04em',
                maxWidth: 520,
                lineHeight: 1.6,
              }}
            >
              <span style={{ color: '#71717a' }}>WHY</span>{' '}
              <span style={{ color: '#b8c4d4' }}>
                {field?.top && field.top !== '—'
                  ? `${field.top} leading the field at pressure ${field.pressure}/100. ${t1Gaps} T1 gaps remain open.`
                  : `Field pressure ${field?.pressure ?? 0}/100. ${t1Gaps} T1 gaps remain open.`}
              </span>
            </div>
          </div>

          {/* ── RIGHT (40%) — HIGH PRESSURE rail ─────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE_SOFT, delay: 0.18 }}
            style={{
              background: '#0f1422',
              border: '0.5px solid rgba(255,255,255,0.07)',
              borderRadius: 3,
              padding: 16,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 14,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#e8703a',
                  animation: 'novaPulse 1.5s ease-in-out infinite',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#e8703a',
                }}
              >
                HIGH PRESSURE
              </span>
            </div>

            {signals.map((s, i) => {
              const dot = SIGNAL_DOT[s.label] || { color: '#71717a', pulse: false }
              return (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.35,
                    ease: EASE_SPRING,
                    delay: 0.25 + i * 0.06,
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 4px',
                    borderBottom:
                      i < signals.length - 1
                        ? '0.5px solid rgba(255,255,255,0.04)'
                        : 'none',
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: dot.color,
                      boxShadow: `0 0 6px ${dot.color}`,
                      animation: dot.pulse
                        ? 'rustPulseSoft 2.5s ease-in-out infinite'
                        : 'none',
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      flex: '0 0 145px',
                      fontFamily: FONT_HEAD,
                      fontSize: 12,
                      color: '#e4e4e7',
                    }}
                  >
                    {s.label}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontFamily: FONT_MONO,
                      fontSize: 11,
                      color: '#71717a',
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.note}
                  </span>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </div>

      {/* N0VA pressure bar — fixed bottom of the SIGNAL viewport, full width
          inside .hz-shell (sits to the right of the sidebar). */}
      <div
        style={{
          position: 'fixed',
          left: 'var(--hz-sidebar)',
          right: 0,
          bottom: 0,
          height: 28,
          background: 'rgba(232,112,58,0.08)',
          borderTop: '0.5px solid rgba(232,112,58,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          fontFamily: FONT_MONO,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.14em',
          color: '#e8703a',
          textTransform: 'uppercase',
          animation: 'novaBarPulse 2s ease-in-out infinite',
          zIndex: 80,
          pointerEvents: 'none',
        }}
      >
        <span style={{ fontSize: 9 }}>◆</span>
        N0VA · {threat.level === 'CRITICAL' ? 'CRITICAL PRESSURE' : threat.level === 'HIGH' ? 'HIGH PRESSURE' : 'MARKET STABLE'} ENGAGED
      </div>
    </Tooltip.Provider>
  )
}

function Sep() {
  return (
    <span style={{ color: '#3f3f46', margin: '0 8px' }}>·</span>
  )
}
