import WindowsPanel from './WindowsPanel'
import OutcomesPanel from './OutcomesPanel'
import LedgerPanel from './LedgerPanel'
import SignalPanel from './SignalPanel'
import BriefPanel from './BriefPanel'
import NetworkPanel from './NetworkPanel'

// Content region for the non-dashboard suite views. Sits inside .hz-shell
// (sidebar offset). Same <main>/.container chrome as the P1 dashboard so
// page gutters and width match exactly.

const PANELS = {
  windows: WindowsPanel,
  outcomes: OutcomesPanel,
  ledger: LedgerPanel,
  signal: SignalPanel,
  brief: BriefPanel,
  network: NetworkPanel,
}

export default function HorizonView({ view, onNav, onAskIntel }) {
  const Panel = PANELS[view]
  return (
    <main
      style={{
        background: 'var(--bg-primary)',
        minHeight: '100vh',
        paddingTop: 48,
      }}
    >
      <div className="container" style={{ padding: '36px 40px 72px' }}>
        {Panel ? <Panel onNav={onNav} onAskIntel={onAskIntel} /> : null}
      </div>
    </main>
  )
}
