import { useState, useEffect, useMemo } from 'react'
import { useOrg } from '../context/OrgContext'
import { getDayStatus, getWindows, assessCompetitors } from '../utils/horizonData'
import { fetchActivations, fetchDecisions } from '../lib/horizonStore'
import { fmtDate } from '../../lib/radar/scoring'
import { Card, Badge, PanelHeader, Btn, FONT_HEAD, FONT_BODY, FONT_MONO } from './horizonUI'

// P7 — CEO Brief. Auto-assembles from live suite data. Internal mode shows
// raw scores; Client Delivery mode keeps narrative language only. Exports a
// clean white PDF (jsPDF, dynamically imported on click).

const ACTION_NARRATIVE = {
  'MOVE NOW': 'act now',
  PREPARE: 'prepare',
  MONITOR: 'monitor',
}

function thisMonth(ts) {
  if (!ts) return false
  const d = new Date(ts)
  const n = new Date()
  return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
}

function buildModel(org) {
  const status = getDayStatus()
  const { rows } = getWindows(90)
  const field = assessCompetitors()
  const top3 = rows.slice(0, 3)
  const nextAction =
    rows.find(w => w.action === 'MOVE NOW') ||
    rows.find(w => w.action === 'PREPARE') ||
    rows[0] ||
    null
  return {
    orgName: org?.name || 'Organisation',
    date: new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }),
    status,
    top3,
    field,
    nextAction,
  }
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
        margin: '22px 0 10px',
      }}
    >
      {children}
    </div>
  )
}

function Line({ children }) {
  return (
    <div
      style={{
        fontFamily: FONT_BODY,
        fontSize: 14,
        color: '#c8d0dc',
        lineHeight: 1.7,
        padding: '3px 0',
      }}
    >
      {children}
    </div>
  )
}

export default function BriefPanel() {
  const { org } = useOrg()
  const [mode, setMode] = useState('internal') // 'internal' | 'client'
  const [activations, setActivations] = useState([])
  const [decisions, setDecisions] = useState([])
  const [exporting, setExporting] = useState(false)

  const model = useMemo(() => buildModel(org), [org])
  const client = mode === 'client'

  useEffect(() => {
    fetchActivations().then(({ data }) => setActivations(data || []))
    fetchDecisions().then(({ data }) => setDecisions(data || []))
  }, [])

  const monthDecisions = decisions.filter(d => thisMonth(d.decided_at))
  const recentActs = activations.slice(0, 5)

  const windowLine = w =>
    client
      ? `${w.event.name} (${fmtDate(w.event.date)}) — ${ACTION_NARRATIVE[w.action]}, in ${w.daysOut} days`
      : `${w.event.name} (${fmtDate(w.event.date)}) — opp ${w.opportunity}, ${w.action}, pressure ${w.pressurePct}%, in ${w.daysOut}d`

  const fieldLine = client
    ? `${model.field.top} is leading the field; competitive pressure is ${model.field.level}.`
    : `Field pressure ${model.field.pressure}/100 (${model.field.level}). ${model.field.top} leads · ${model.field.activeCount} competitors active.`

  const nextLine = model.nextAction
    ? client
      ? `${model.nextAction.event.name} — ${ACTION_NARRATIVE[model.nextAction.action]} (window ${fmtDate(model.nextAction.event.date)}).`
      : `${model.nextAction.event.name} — ${model.nextAction.action}, opportunity ${model.nextAction.opportunity}, ${model.nextAction.daysOut}d out.`
    : 'No actionable window inside the horizon.'

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

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.setTextColor(20, 24, 34)
      doc.text('Horiz0n Brief', M, y)
      y += 6
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(120, 128, 140)
      doc.text(client ? 'Client Delivery' : 'Internal', M, y)
      y += 12

      const section = title => {
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
        const lines = doc.splitTextToSize(txt, W - M * 2)
        lines.forEach(ln => {
          if (y > 270) {
            doc.addPage()
            y = 20
          }
          doc.text(ln, M, y)
          y += 6
        })
      }

      section("Today's status")
      para(`The day reads ${model.status.overall}.`)
      model.status.signals.forEach(s =>
        para(`• ${s.label}: ${s.rag.toUpperCase()} — ${s.note}`),
      )

      section('Top upcoming windows')
      model.top3.forEach(w => para(`• ${windowLine(w)}`))

      section('Recent activations & outcomes')
      if (recentActs.length === 0) para('• No activations recorded yet.')
      recentActs.forEach(a =>
        para(
          `• ${a.event_name || 'Activation'} — ${a.outcome ? a.outcome.toUpperCase() : a.outcome_status || 'pending'}`,
        ),
      )

      section('Key decisions this month')
      if (monthDecisions.length === 0) para('• No decisions logged this month.')
      monthDecisions
        .slice(0, 8)
        .forEach(d => para(`• ${d.decision.toUpperCase()} — ${d.event_name || '—'}`))

      section('Competitor landscape')
      para(fieldLine)

      section('Recommended next action')
      para(nextLine)

      doc.setDrawColor(210, 214, 220)
      doc.line(M, 285, W - M, 285)
      doc.setFontSize(9)
      doc.setTextColor(120, 128, 140)
      doc.text('Prepared by COINsiglieri', M, 290)

      const safe = model.orgName.replace(/[^a-z0-9]+/gi, '_')
      const dstr = new Date().toISOString().slice(0, 10)
      doc.save(`Horiz0n_Brief_${safe}_${dstr}.pdf`)
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
        sub="Auto-assembled from live suite data — leadership or client delivery"
      />

      {/* Controls */}
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
        <Btn tone="#94c864" onClick={exportPdf} disabled={exporting}>
          {exporting ? 'Generating…' : '↧ Export PDF'}
        </Btn>
      </div>

      {/* In-app brief */}
      <Card style={{ padding: '28px 32px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 12,
            paddingBottom: 16,
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

        <SectionTitle>Today’s status</SectionTitle>
        <Line>
          The day reads{' '}
          <span
            style={{
              color:
                model.status.overall === 'RED'
                  ? '#ff4d6d'
                  : model.status.overall === 'AMBER'
                  ? '#D4A853'
                  : '#94c864',
              fontFamily: FONT_HEAD,
              fontWeight: 700,
            }}
          >
            {model.status.overall}
          </span>
          .
        </Line>
        {model.status.signals.map(s => (
          <Line key={s.label}>
            • {s.label}: {s.rag.toUpperCase()} — {s.note}
          </Line>
        ))}

        <SectionTitle>Top upcoming windows</SectionTitle>
        {model.top3.map(w => (
          <Line key={w.event.id}>• {windowLine(w)}</Line>
        ))}

        <SectionTitle>Recent activations &amp; outcomes</SectionTitle>
        {recentActs.length === 0 ? (
          <Line>• No activations recorded yet.</Line>
        ) : (
          recentActs.map(a => (
            <Line key={a.id}>
              • {a.event_name || 'Activation'} —{' '}
              {a.outcome ? a.outcome.toUpperCase() : a.outcome_status || 'pending'}
            </Line>
          ))
        )}

        <SectionTitle>Key decisions this month</SectionTitle>
        {monthDecisions.length === 0 ? (
          <Line>• No decisions logged this month.</Line>
        ) : (
          monthDecisions.slice(0, 8).map(d => (
            <Line key={d.id}>
              • {d.decision.toUpperCase()} — {d.event_name || '—'}
            </Line>
          ))
        )}

        <SectionTitle>Competitor landscape</SectionTitle>
        <Line>{fieldLine}</Line>

        <SectionTitle>Recommended next action</SectionTitle>
        <Line>{nextLine}</Line>

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
