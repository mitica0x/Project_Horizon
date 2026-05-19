import { useState } from 'react'
import LedgerPanel from './LedgerPanel'
import OutcomesPanel from './OutcomesPanel'

const mono = { fontFamily: 'var(--font-mono)' }

export default function HistoryPanel({ onAskIntel }) {
  const [tab, setTab] = useState('decisions')
  const active = { ...mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '6px 16px', borderRadius: 4, border: '1px solid var(--cyan)', background: 'rgba(0,212,232,0.1)', color: 'var(--cyan)', cursor: 'pointer' }
  const inactive = { ...mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '6px 16px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '20px 32px 0', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 0 }}>
        <span style={{ ...mono, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', marginRight: 16 }}>HISTORY</span>
        <button onClick={() => setTab('decisions')} style={tab === 'decisions' ? active : inactive}>Decisions</button>
        <button onClick={() => setTab('outcomes')} style={tab === 'outcomes' ? active : inactive}>Outcomes</button>
      </div>
      {tab === 'decisions' ? <LedgerPanel onAskIntel={onAskIntel} hideHeader /> : <OutcomesPanel onAskIntel={onAskIntel} hideHeader />}
    </div>
  )
}
