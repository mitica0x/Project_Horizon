import { PanelHeader, EmptyState } from './horizonUI'

// Stub — real implementation lands in P5.
export default function LedgerPanel() {
  return (
    <>
      <PanelHeader title="Decision Ledger" accent="#00d4e8" sub="Every activate / skip / defer" />
      <EmptyState>Module activates in P5</EmptyState>
    </>
  )
}
