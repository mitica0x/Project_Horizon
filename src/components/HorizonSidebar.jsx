import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Activity, CalendarDays, BarChart2, MessageCircle, History, Radar, Zap } from 'lucide-react'
import { FONT_HEAD, FONT_MONO } from './horizonUI'
import { statusVerdict, getDayStatus } from '../utils/horizonData'

const STATUS_MICRO = {
  'HIGH PRESSURE': '3 actions · market moving',
  'ELEVATED WATCH': '1 action · monitor market',
  'ALL CLEAR': 'Market clear',
}

const NAV = [
  { id: 'signal',  label: 'SIGNAL',           Icon: Activity },
  { id: 'events',  label: 'EVENTS',           Icon: CalendarDays },
  { id: 'compare', label: 'COMPARE',          Icon: BarChart2 },
  { id: 'brief',   label: 'Ask C0insiglieri', Icon: MessageCircle },
  { id: 'history', label: 'HISTORY',          Icon: History },
]

const COLLAPSE_KEY = 'horizon_sidebar_collapsed'

// Spec easing — "snap" cubic-bezier(0.16, 1, 0.3, 1) for sidebar interactions.
const EASE_SNAP = 'cubic-bezier(0.16, 1, 0.3, 1)'

function NavRow({ Icon, label, active, onClick, collapsed, subLine }) {
  const [hover, setHover] = useState(false)
  const lit = active || hover
  const color = active ? '#ffffff' : lit ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)'
  return (
    <button
      onClick={onClick}
      title={label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        textAlign: 'left',
        justifyContent: collapsed ? 'center' : 'flex-start',
        background: active
          ? 'rgba(255,255,255,0.04)'
          : hover
          ? 'rgba(255,255,255,0.03)'
          : 'transparent',
        border: 'none',
        borderLeft: `2px solid ${active ? 'var(--emerald)' : 'transparent'}`,
        padding: collapsed ? '11px 0' : '10px 14px 10px 13px',
        cursor: 'pointer',
        color,
        fontFamily: FONT_MONO,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        transform: hover && !active ? 'translateX(2px)' : 'translateX(0)',
        transition: `color 150ms ${EASE_SNAP}, background 150ms ${EASE_SNAP}, border-color 150ms ${EASE_SNAP}, transform 150ms ${EASE_SNAP}`,
      }}
    >
      <Icon
        size={14}
        strokeWidth={1.75}
        style={{
          flexShrink: 0,
          color: active ? 'var(--emerald)' : color,
          transition: `color 150ms ${EASE_SNAP}`,
        }}
      />
      {!collapsed && (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {label}
          </span>
          {subLine && (
            <span
              style={{
                fontFamily: FONT_MONO,
                fontSize: 9,
                letterSpacing: '0.04em',
                textTransform: 'none',
                color: 'var(--text-muted)',
                fontWeight: 400,
              }}
            >
              {subLine}
            </span>
          )}
        </span>
      )}
    </button>
  )
}

function Divider() {
  return (
    <div
      style={{
        height: 1,
        background: 'var(--border)',
        margin: '8px 12px',
      }}
    />
  )
}

export default function HorizonSidebar({
  view,
  onNav,
  onNova,
  onIntel,
  onScan,
  scanState = 'idle',
  compactStatus,
  // onTrace kept in the prop API for compatibility with App.jsx, though the
  // sidebar no longer renders a TRACE row (ScopePanel still reachable elsewhere).
  // eslint-disable-next-line no-unused-vars
  onTrace,
}) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [novaHover, setNovaHover] = useState(false)
  const [scanHover, setScanHover] = useState(false)
  const isScanning =
    scanState && scanState !== 'idle' && scanState !== 'complete' && scanState !== 'error'

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--hz-sidebar',
      collapsed ? '52px' : '152px',
    )
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
    return () => document.documentElement.style.removeProperty('--hz-sidebar')
  }, [collapsed])

  const verdict = compactStatus ? statusVerdict(compactStatus) : null
  const statusMicro =
    STATUS_MICRO[(verdict || statusVerdict(getDayStatus().overall)).label] || null
  // Sub-line under SIGNAL row — only meaningful while we have a live verdict.
  const signalSub = statusMicro

  return (
    <nav
      className="hz-nav"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 150,
        background: 'var(--bg-panel)',
        borderRight: '0.5px solid rgba(255,255,255,0.07)',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      {/* Wordmark — C / 0 (emerald) / IN / SIGLIERI (cyan) */}
      <button
        onClick={() => onNav('signal')}
        title="C0insiglieri — signal"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0,
          background: 'none',
          border: 'none',
          borderBottom: '0.5px solid rgba(255,255,255,0.07)',
          padding: '14px 10px',
          cursor: 'pointer',
          fontFamily: FONT_HEAD,
          fontWeight: 800,
          fontSize: collapsed ? 16 : 14,
          letterSpacing: '0.10em',
          transition: 'color 0.15s',
        }}
      >
        {collapsed ? (
          <>
            <span style={{ color: '#ffffff' }}>C</span>
            <span style={{ color: 'var(--emerald)' }}>0</span>
          </>
        ) : (
          <>
            <span style={{ color: '#ffffff' }}>C</span>
            <span style={{ color: 'var(--emerald)' }}>0</span>
            <span style={{ color: '#ffffff' }}>IN</span>
            <span style={{ color: 'var(--cyan)' }}>SIGLIERI</span>
          </>
        )}
      </button>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(c => !c)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-end',
          background: 'none',
          border: 'none',
          padding: '4px 12px',
          marginTop: 40,
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontSize: 11,
          fontFamily: FONT_MONO,
        }}
      >
        {collapsed ? '»' : '«'}
      </button>

      {/* Compact day verdict — shown when the STATUS board is dismissed */}
      {verdict && (
        <button
          onClick={() => onNav('signal')}
          title={`Open signal — ${verdict.label}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: 'rgba(255,255,255,0.02)',
            border: 'none',
            borderBottom: '0.5px solid var(--border)',
            padding: '8px 10px',
            cursor: 'pointer',
            fontFamily: FONT_MONO,
            fontSize: 9,
            letterSpacing: '0.1em',
            color: verdict.color,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: verdict.color,
              boxShadow: `0 0 6px ${verdict.color}`,
              flexShrink: 0,
            }}
          />
          {!collapsed && verdict.label}
        </button>
      )}

      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 6 }}>
        {/* SIGNAL / EVENTS / COMPARE */}
        {NAV.slice(0, 3).map(it => (
          <NavRow
            key={it.id}
            Icon={it.Icon}
            label={it.label}
            active={view === it.id}
            collapsed={collapsed}
            subLine={it.id === 'signal' ? signalSub : undefined}
            onClick={() => onNav(it.id)}
          />
        ))}

        <Divider />

        {/* ASK C0INSIGLIERI — opens AskTheBrief overlay (no view change) */}
        <NavRow
          Icon={NAV[3].Icon}
          label={NAV[3].label}
          active={false}
          collapsed={collapsed}
          onClick={onIntel}
        />

        {/* HISTORY */}
        <NavRow
          Icon={NAV[4].Icon}
          label={NAV[4].label}
          active={view === 'history'}
          collapsed={collapsed}
          onClick={() => onNav('history')}
        />
      </div>

      {/* SCAN NOW — emerald, anchored above N0VA */}
      {onScan && (
        <motion.button
          onClick={onScan}
          disabled={isScanning}
          onMouseEnter={() => setScanHover(true)}
          onMouseLeave={() => setScanHover(false)}
          title={isScanning ? 'Scan in progress' : 'Run scan now'}
          animate={{
            scale: scanHover && !isScanning ? 1.01 : 1,
            boxShadow: scanHover && !isScanning
              ? '0 0 20px rgba(13,190,130,0.25)'
              : '0 0 14px rgba(13,190,130,0.15)',
          }}
          transition={{ duration: 0.15 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            marginTop: 6,
            marginBottom: 8,
            marginLeft: 8,
            width: 'calc(100% - 16px)',
            padding: '8px 10px',
            background: 'rgba(13,190,130,0.06)',
            border: '0.5px solid rgba(13,190,130,0.45)',
            borderRadius: 3,
            color: 'var(--emerald)',
            fontFamily: FONT_MONO,
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            cursor: isScanning ? 'default' : 'pointer',
            opacity: isScanning ? 0.6 : 1,
            transition: 'color 0.15s, border-color 0.15s, opacity 0.15s',
          }}
        >
          <Radar size={11} strokeWidth={2} style={{ flexShrink: 0 }} />
          {!collapsed && (isScanning ? 'Scanning…' : 'SCAN NOW')}
        </motion.button>
      )}

      {/* N0VA — rust, pinned bottom with pulse dot */}
      <button
        onClick={onNova}
        title="Activate N0VA"
        onMouseEnter={() => setNovaHover(true)}
        onMouseLeave={() => setNovaHover(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          background: novaHover ? 'rgba(232,112,58,0.12)' : 'rgba(232,112,58,0.05)',
          border: 'none',
          borderTop: '0.5px solid rgba(232,112,58,0.3)',
          padding: '14px 10px',
          cursor: 'pointer',
          color: 'var(--rust)',
          fontFamily: FONT_MONO,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.14em',
          boxShadow: novaHover
            ? 'inset 0 1px 0 rgba(196,97,42,0.4), 0 -4px 14px rgba(232,112,58,0.12)'
            : 'inset 0 1px 0 rgba(196,97,42,0.25)',
          transition: 'background 0.15s, box-shadow 0.15s',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--rust)',
            animation: 'novaPulse 1.5s ease-in-out infinite',
            flexShrink: 0,
          }}
        />
        <Zap size={11} strokeWidth={2.25} style={{ flexShrink: 0 }} />
        {!collapsed && <span>N0VA</span>}
      </button>
    </nav>
  )
}
