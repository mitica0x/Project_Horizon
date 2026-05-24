import { useState, useEffect } from 'react'
import LedgerPanel from './LedgerPanel'
import OutcomesPanel from './OutcomesPanel'

const mono = { fontFamily: "'Geist Mono', monospace" }

// Tab chip styling — active = cyan (intel/data axis), inactive = muted.
const active = {
  ...mono,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  padding: '6px 16px',
  borderRadius: 3,
  border: '1px solid #18b4d4',
  background: 'rgba(24,180,212,0.10)',
  color: '#18b4d4',
  cursor: 'pointer',
}
const inactive = {
  ...mono,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  padding: '6px 16px',
  borderRadius: 3,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'transparent',
  color: '#8892a4',
  cursor: 'pointer',
}

export default function HistoryPanel({ onAskIntel, initialTab = 'decisions' }) {
  const [tab, setTab] = useState(initialTab)
  useEffect(() => {
    setTab(initialTab)
  }, [initialTab])

  return (
    <div>
      <div
        style={{
          padding: '20px 32px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div style={{
          fontFamily: "'Geist', sans-serif",
          fontSize: 18,
          fontWeight: 700,
          color: '#ffffff',
          letterSpacing: '-0.01em',
        }}>
          ARCHIVAL SESSION LOGS
        </div>
        <div style={{
          ...mono,
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#8892a4',
          marginTop: 4,
        }}>
          HISTORIC DIAGNOSTICS ARCHIVE
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <button onClick={() => setTab('decisions')} style={tab === 'decisions' ? active : inactive}>
            Decisions
          </button>
          <button onClick={() => setTab('outcomes')} style={tab === 'outcomes' ? active : inactive}>
            Outcomes
          </button>
        </div>
      </div>
      {tab === 'decisions' ? (
        <LedgerPanel onAskIntel={onAskIntel} hideHeader />
      ) : (
        <OutcomesPanel onAskIntel={onAskIntel} hideHeader />
      )}
    </div>
  )
}
