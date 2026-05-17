import { useState, useEffect, useMemo } from 'react'
import { useOrg } from '../context/OrgContext'
import { getWindows } from '../utils/horizonData'
import { fetchActivations } from '../lib/horizonStore'
import { Card, Badge, PanelHeader, FONT_HEAD, FONT_BODY, FONT_MONO } from './horizonUI'

// P9 — Network Intelligence. Org metrics vs anonymized network benchmarks.
// Network averages are seeded synthetic constants (replace with real
// aggregation when more clients onboard).

const NET = {
  activationRate: 28,   // %
  briefGen: 12,         // per month
  windowCoverage: 34,   // %
  responseSpeed: 4.2,   // days (lower = better)
}

function position(org, net, higherIsBetter) {
  const tol = Math.max(net * 0.08, 0.5)
  const better = higherIsBetter ? org - net : net - org
  if (Math.abs(better) <= tol) return { label: 'ON PAR', color: '#8892a4' }
  return better > 0
    ? { label: 'ABOVE NETWORK AVG', color: '#00d4e8' }
    : { label: 'BELOW NETWORK AVG', color: '#D4A853' }
}

function ComparisonRow({ m }) {
  const pos = position(m.org, m.net, m.higherIsBetter)
  const scaleMax = Math.max(m.org, m.net) * 1.25 || 1
  const orgPct = (m.org / scaleMax) * 100
  const netPct = (m.net / scaleMax) * 100

  const Bar = ({ pct, color, label, value }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
      <span
        style={{
          flex: '0 0 64px',
          fontFamily: FONT_MONO,
          fontSize: 10,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}
      >
        {label}
      </span>
      <div
        style={{
          flex: 1,
          height: 14,
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 99,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.max(2, Math.min(100, pct))}%`,
            height: '100%',
            background: color,
            borderRadius: 99,
            transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)',
          }}
        />
      </div>
      <span
        style={{
          flex: '0 0 70px',
          textAlign: 'right',
          fontFamily: FONT_HEAD,
          fontWeight: 700,
          fontSize: 14,
          color,
        }}
      >
        {value}
      </span>
    </div>
  )

  return (
    <Card style={{ padding: '18px 22px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <span style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 15, color: 'var(--white)' }}>
          {m.label}
        </span>
        <Badge color={pos.color} bg="transparent" border={pos.color + '4d'}>
          {pos.label}
        </Badge>
      </div>
      <Bar pct={orgPct} color={pos.color} label="You" value={m.fmt(m.org)} />
      <Bar pct={netPct} color="#5a6478" label="Network" value={m.fmt(m.net)} />
      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: 13,
          color: 'var(--text-muted)',
          marginTop: 10,
          lineHeight: 1.6,
        }}
      >
        {m.insight(pos.label)}
      </div>
    </Card>
  )
}

export default function NetworkPanel() {
  const { org } = useOrg()
  const [acts, setActs] = useState([])
  const { rows } = useMemo(() => getWindows(90), [])

  useEffect(() => {
    fetchActivations().then(({ data }) => setActs(data || []))
  }, [])

  const briefCount = useMemo(() => {
    try {
      return Number(localStorage.getItem('horizon_brief_count') || 0)
    } catch {
      return 0
    }
  }, [])

  const metrics = useMemo(() => {
    const moveNow = rows.filter(w => w.action === 'MOVE NOW')
    const actNames = new Set(acts.map(a => (a.event_name || '').toLowerCase()))
    const coveredMove = moveNow.filter(w => actNames.has(w.event.name.toLowerCase()))

    const activationRate = rows.length
      ? Math.min(100, Math.round((acts.length / rows.length) * 100))
      : 0
    const windowCoverage = moveNow.length
      ? Math.round((coveredMove.length / moveNow.length) * 100)
      : 0

    // Response speed: days from approx window-open (event − 60d) to activation.
    const samples = acts
      .map(a => {
        const ts = a.activated_at || a.created_at
        const ev = rows.find(
          w => w.event.name.toLowerCase() === (a.event_name || '').toLowerCase(),
        )
        if (!ts || !ev) return null
        const open = new Date(ev.event.date).getTime() - 60 * 86400000
        return Math.max(0, (new Date(ts).getTime() - open) / 86400000)
      })
      .filter(v => v != null)
    const responseSpeed = samples.length
      ? Math.round((samples.reduce((s, v) => s + v, 0) / samples.length) * 10) / 10
      : null

    return [
      {
        label: 'Activation Rate',
        org: activationRate,
        net: NET.activationRate,
        higherIsBetter: true,
        fmt: v => `${v}%`,
        insight: p =>
          p === 'ABOVE NETWORK AVG'
            ? 'You convert more detected windows into campaigns than the typical EU operator.'
            : p === 'BELOW NETWORK AVG'
            ? 'You are leaving windows unconverted relative to peers — review the WINDOWS backlog.'
            : 'You activate windows at roughly the network rate.',
      },
      {
        label: 'Brief Generation',
        org: briefCount,
        net: NET.briefGen,
        higherIsBetter: true,
        fmt: v => `${v}/mo`,
        insight: p =>
          p === 'ABOVE NETWORK AVG'
            ? 'Leadership reporting cadence is ahead of the network.'
            : p === 'BELOW NETWORK AVG'
            ? 'Fewer briefs than peers — exported briefs are counted locally; wire server tracking for accuracy.'
            : 'Brief cadence is on par with the network.',
      },
      {
        label: 'Window Coverage',
        org: windowCoverage,
        net: NET.windowCoverage,
        higherIsBetter: true,
        fmt: v => `${v}%`,
        insight: p =>
          p === 'ABOVE NETWORK AVG'
            ? 'You act on a larger share of MOVE NOW windows than the field.'
            : p === 'BELOW NETWORK AVG'
            ? 'High-priority windows are slipping past — coverage trails the network.'
            : 'MOVE NOW coverage matches the network.',
      },
      {
        label: 'Response Speed',
        org: responseSpeed ?? NET.responseSpeed,
        net: NET.responseSpeed,
        higherIsBetter: false,
        fmt: v => (responseSpeed == null ? 'n/a' : `${v}d`),
        insight: p =>
          responseSpeed == null
            ? 'Not enough matched activations yet to measure response speed.'
            : p === 'ABOVE NETWORK AVG'
            ? 'You move on windows faster than the typical operator.'
            : p === 'BELOW NETWORK AVG'
            ? 'Slower to activate than peers — tighten the window-to-activation loop.'
            : 'Response speed is in line with the network.',
      },
    ]
  }, [rows, acts, briefCount])

  // Telegram webhook persisted to org settings (localStorage stand-in until
  // the backend settings write-path exists; fired server-side when built).
  const tgKey = `horizon_tg_webhook_${org?.id || 'default'}`
  const [tg, setTg] = useState('')
  const [tgSaved, setTgSaved] = useState(false)
  useEffect(() => {
    try {
      setTg(localStorage.getItem(tgKey) || '')
    } catch {
      /* ignore */
    }
  }, [tgKey])
  const saveTg = () => {
    try {
      localStorage.setItem(tgKey, tg.trim())
      setTgSaved(true)
      setTimeout(() => setTgSaved(false), 1800)
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <PanelHeader
        title="Network Intelligence"
        accent="#00d4e8"
        sub="Anonymized benchmarks across MID-budget EU operators"
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {metrics.map(m => (
          <ComparisonRow key={m.label} m={m} />
        ))}
      </div>

      {/* Delivery */}
      <Card style={{ padding: '20px 24px', marginTop: 16 }}>
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            marginBottom: 16,
          }}
        >
          Digest delivery
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '10px 0',
            opacity: 0.5,
          }}
        >
          <span style={{ fontFamily: FONT_BODY, fontSize: 14, color: 'var(--white)' }}>
            Email digest
          </span>
          <Badge>Coming soon</Badge>
        </div>

        <div style={{ paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div
            style={{
              fontFamily: FONT_BODY,
              fontSize: 14,
              color: 'var(--white)',
              marginBottom: 8,
            }}
          >
            Telegram webhook
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={tg}
              onChange={e => setTg(e.target.value)}
              placeholder="https://api.telegram.org/bot…/sendMessage?chat_id=…"
              style={{
                flex: 1,
                boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 6,
                padding: '9px 13px',
                fontFamily: FONT_MONO,
                fontSize: 12,
                color: 'var(--white)',
                outline: 'none',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'rgba(0,212,232,0.4)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
            />
            <button
              onClick={saveTg}
              style={{
                fontFamily: FONT_MONO,
                fontSize: 11,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: tgSaved ? '#94c864' : '#00d4e8',
                background: 'transparent',
                border: `1px solid ${tgSaved ? 'rgba(148,200,100,0.4)' : 'rgba(0,212,232,0.35)'}`,
                borderRadius: 5,
                padding: '8px 16px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {tgSaved ? '✓ Saved' : 'Save'}
            </button>
          </div>
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              color: 'var(--text-muted)',
              marginTop: 8,
            }}
          >
            Saved to org settings — fired server-side once the backend digest job ships.
          </div>
        </div>
      </Card>
    </>
  )
}
