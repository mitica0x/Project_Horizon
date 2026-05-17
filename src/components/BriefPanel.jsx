import { useState, useEffect, useMemo } from 'react'
import { useOrg } from '../context/OrgContext'
import { getWindows } from '../utils/horizonData'
import { intelKit } from '../utils/intelKit'
import { fetchActivations, fetchDecisions } from '../lib/horizonStore'
import { fmtDate } from '../../lib/radar/scoring'
import {
  Card,
  Badge,
  PanelHeader,
  AskIntelButton,
  FONT_HEAD,
  FONT_BODY,
  FONT_MONO,
} from './horizonUI'

// P7 — CEO Brief, narrative-first. Opening line is outcome-aware. Client
// Delivery mode strips field commentary + pattern read.

const DAY = 86400000

// Static seeded field commentary (competitor read).
const FIELD_DID = [
  'Binance activated on ETF narrative — third consecutive week of deployment.',
  'OKX expanded comparison-site footprint across DE / NL placements.',
  'Bitget stayed quiet — no new tracked placements detected this cycle.',
]

function readPosture() {
  try {
    const p = JSON.parse(localStorage.getItem('horizon_signal_posture') || 'null')
    if (p && p.signal) {
      const days = Math.max(
        0,
        Math.round((Date.now() - new Date(p.since).getTime()) / DAY),
      )
      return { signal: p.signal, days }
    }
  } catch {
    /* ignore */
  }
  return { signal: 'PREPARE', days: 0 }
}

function openingLine(lastOutcome) {
  if (lastOutcome === 'win')
    return 'Strong close. Your last activation performed above pattern — the field is watching.'
  if (lastOutcome === 'miss')
    return 'Consolidation week. You held while others moved — your next activation window carries elevated stakes.'
  return 'Pattern building. Every decision logged from here sharpens the intelligence.'
}

function SectionTitle({ children }) {
  return (
    <div
      style={{
        fontFamily: FONT_HEAD,
        fontWeight: 700,
        fontSize: 13,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--cyan)',
        margin: '24px 0 10px',
      }}
    >
      {children}
    </div>
  )
}

function Line({ children, dim }) {
  return (
    <div
      style={{
        fontFamily: dim ? FONT_MONO : FONT_BODY,
        fontSize: dim ? 12 : 14,
        color: dim ? 'var(--text-muted)' : '#c8d0dc',
        lineHeight: 1.7,
        padding: '3px 0',
      }}
    >
      {children}
    </div>
  )
}

export default function BriefPanel({ onAskIntel }) {
  const { org } = useOrg()
  const [mode, setMode] = useState('internal')
  const [activations, setActivations] = useState([])
  const [decisions, setDecisions] = useState([])
  const [exporting, setExporting] = useState(false)
  const { rows } = useMemo(() => getWindows(90), [])
  const posture = useMemo(() => readPosture(), [])
  const client = mode === 'client'

  useEffect(() => {
    fetchActivations().then(({ data }) => setActivations(data || []))
    fetchDecisions().then(({ data }) => setDecisions(data || []))
  }, [])

  const model = useMemo(() => {
    const withOutcome = activations.filter(a => a.outcome)
    const wins = withOutcome.filter(a => a.outcome === 'win').length
    const winRate = withOutcome.length
      ? Math.round((wins / withOutcome.length) * 100)
      : null
    const lastOutcome = activations.find(a => a.outcome)?.outcome || null
    const skips = decisions.filter(d => d.decision === 'skip').length
    const acts = activations.length
    const forward = rows
      .filter(w => w.daysOut <= 14)
      .sort((a, b) => b.opportunity - a.opportunity)
      .slice(0, 3)
    const forwardFallback = forward.length
      ? forward
      : rows.slice(0, 3)

    let patternRead
    if (winRate == null || withOutcome.length < 5)
      patternRead = 'Insufficient history — pattern read available after 5 logged outcomes.'
    else if (winRate > 60)
      patternRead = 'You are operating above your baseline. Posture is strong.'
    else if (winRate < 40)
      patternRead = 'Below-baseline period. Review LEDGER for pattern drift.'
    else
      patternRead = 'Holding near baseline — no decisive drift either direction.'

    return {
      orgName: org?.name || 'Organisation',
      date: new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }),
      opening: openingLine(lastOutcome),
      winRate,
      acts,
      skips,
      patternRead,
      forward: forwardFallback,
      hasForward: forward.length > 0,
    }
  }, [activations, decisions, rows, org])

  const intelContext = () =>
    `You are reviewing the weekly intelligence brief. Opening: "${model.opening}" Activity: ${model.acts} activations, ${model.skips} skips, posture ${posture.signal} (${posture.days}d). Pattern: ${model.patternRead}`

  const briefGap =
    model.acts === 0
      ? 'the field is moving while your activation log is empty — narrative shows competitor motion you have not answered'
      : model.skips > model.acts
      ? 'your skips outpace activations — the brief reads steadier than your actual cadence'
      : 'field competitor moves are not yet reflected against your own activation timing'

  const askIntel = () =>
    onAskIntel(
      intelContext(),
      intelKit.brief({
        events: model.forward.length,
        moves: FIELD_DID.length,
        gap: briefGap,
      }),
    )

  // ---- PDF export -----------------------------------------------------------
  const exportPdf = async () => {
    setExporting(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const W = 210
      const M = 18
      let y = 20

      doc.setTextColor(20, 24, 34)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(15)
      doc.text(model.orgName, M, y)
      doc.setFontSize(13)
      doc.setTextColor(60, 70, 90)
      doc.text('C0insiglieri', W - M, y, { align: 'right' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(120, 128, 140)
      doc.text(model.date, M, y + 6)
      doc.setDrawColor(210, 214, 220)
      doc.line(M, y + 10, W - M, y + 10)
      y += 20

      doc.setFont('helvetica', 'bolditalic')
      doc.setFontSize(14)
      doc.setTextColor(0, 150, 170)
      doc.splitTextToSize(model.opening, W - M * 2).forEach(ln => {
        doc.text(ln, M, y)
        y += 7
      })
      y += 6

      const section = title => {
        if (y > 265) {
          doc.addPage()
          y = 20
        }
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.setTextColor(0, 150, 170)
        doc.text(title.toUpperCase(), M, y)
        y += 6
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(11)
        doc.setTextColor(40, 46, 58)
      }
      const para = txt => {
        doc.splitTextToSize(txt, W - M * 2).forEach(ln => {
          if (y > 275) {
            doc.addPage()
            y = 20
          }
          doc.text(ln, M, y)
          y += 6
        })
      }

      if (!client) {
        section('What the field did')
        FIELD_DID.forEach(b => para(`• ${b}`))
      }
      section('What you did')
      para(
        model.acts || model.skips
          ? `${model.acts} activation(s), ${model.skips} skip(s). Posture ${posture.signal} for ${posture.days} day(s).`
          : 'No activations logged this period.',
      )
      if (!client) {
        section('Pattern read')
        para(model.patternRead)
      }
      section('Forward 14 days')
      if (model.hasForward) {
        model.forward.forEach(w =>
          para(`• ${w.event.name} (${fmtDate(w.event.date)}) — ${w.action}`),
        )
      } else {
        para('No high-priority windows flagged in next 14 days.')
      }

      doc.setDrawColor(210, 214, 220)
      doc.line(M, 285, W - M, 285)
      doc.setFontSize(9)
      doc.setTextColor(120, 128, 140)
      doc.text('Prepared by COINsiglieri', M, 290)

      const safe = model.orgName.replace(/[^a-z0-9]+/gi, '_')
      doc.save(`Horiz0n_Brief_${safe}_${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[brief] pdf export failed', e)
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PanelHeader
        title="CEO Brief"
        accent="#00d4e8"
        sub="Narrative-first — auto-assembled from live suite data"
        right={onAskIntel && <AskIntelButton onClick={askIntel} />}
      />

      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: 18,
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { id: 'internal', label: 'Internal' },
            { id: 'client', label: 'Client Delivery' },
          ].map(m => {
            const active = mode === m.id
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  color: active ? 'var(--cyan)' : 'var(--text-muted)',
                  background: active ? 'rgba(0,212,232,0.08)' : 'transparent',
                  border: `1px solid ${active ? 'rgba(0,212,232,0.35)' : 'var(--border)'}`,
                  borderRadius: 5,
                  padding: '7px 14px',
                  cursor: 'pointer',
                  transition: 'color 0.15s, border-color 0.15s, background 0.15s',
                }}
              >
                {m.label}
              </button>
            )
          })}
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={exportPdf}
          disabled={exporting}
          style={{
            fontFamily: FONT_MONO,
            fontSize: 12,
            letterSpacing: '0.04em',
            color: exporting ? 'var(--text-muted)' : '#94c864',
            background: '#131929',
            border: '1px solid rgba(148,200,100,0.3)',
            borderRadius: 6,
            padding: '9px 16px',
            cursor: exporting ? 'default' : 'pointer',
          }}
        >
          {exporting ? 'Generating…' : '↧ Export PDF'}
        </button>
      </div>

      <Card style={{ padding: '30px 34px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 12,
            paddingBottom: 18,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div>
            <div style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 20, color: 'var(--white)' }}>
              {model.orgName}
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {model.date} · Horiz0n Brief
            </div>
          </div>
          <Badge
            color={client ? '#94c864' : '#00d4e8'}
            bg="transparent"
            border={(client ? '#94c864' : '#00d4e8') + '4d'}
          >
            {client ? 'Client Delivery' : 'Internal'}
          </Badge>
        </div>

        {/* Opening line — large, cyan, italic */}
        <div
          style={{
            fontFamily: FONT_HEAD,
            fontStyle: 'italic',
            fontSize: 22,
            lineHeight: 1.45,
            color: '#00d4e8',
            margin: '22px 0 6px',
          }}
        >
          {model.opening}
        </div>

        {!client && (
          <>
            <SectionTitle>What the field did</SectionTitle>
            {FIELD_DID.map((b, i) => (
              <Line key={i} dim>
                • {b}
              </Line>
            ))}
          </>
        )}

        <SectionTitle>What you did</SectionTitle>
        {model.acts || model.skips ? (
          <Line>
            {model.acts} activation{model.acts === 1 ? '' : 's'}, {model.skips} skip
            {model.skips === 1 ? '' : 's'}. Posture{' '}
            <span style={{ color: 'var(--cyan)', fontFamily: FONT_HEAD, fontWeight: 700 }}>
              {posture.signal}
            </span>{' '}
            for {posture.days} day{posture.days === 1 ? '' : 's'}.
          </Line>
        ) : (
          <Line>No activations logged this period.</Line>
        )}

        {!client && (
          <>
            <SectionTitle>Pattern read</SectionTitle>
            <Line>{model.patternRead}</Line>
          </>
        )}

        <SectionTitle>Forward 14 days</SectionTitle>
        {model.hasForward ? (
          model.forward.map(w => (
            <Line key={w.event.id}>
              • {w.event.name} ({fmtDate(w.event.date)}) —{' '}
              <span style={{ color: 'var(--cyan)' }}>{w.action}</span>
            </Line>
          ))
        ) : (
          <Line>No high-priority windows flagged in next 14 days.</Line>
        )}

        <div
          style={{
            marginTop: 24,
            paddingTop: 14,
            borderTop: '1px solid rgba(255,255,255,0.06)',
            fontFamily: FONT_MONO,
            fontSize: 11,
            color: 'var(--text-muted)',
          }}
        >
          Prepared by COINsiglieri
        </div>
      </Card>
    </>
  )
}
