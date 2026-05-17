import { PanelHeader, EmptyState } from './horizonUI'

// Stub — real implementation lands in P4.
export default function OutcomesPanel() {
  return (
    <>
      <PanelHeader title="Campaign Outcomes" accent="#94c864" sub="Activation tracking" />
      <EmptyState>Module activates in P4</EmptyState>
    </>
  )
}
