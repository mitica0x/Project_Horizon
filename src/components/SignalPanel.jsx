import { PanelHeader, EmptyState } from './horizonUI'

// Stub — real implementation lands in P8.
export default function SignalPanel() {
  return (
    <>
      <PanelHeader title="Budget Deployment Signal" accent="#94c864" sub="Deploy / hold / prepare" />
      <EmptyState>Module activates in P8</EmptyState>
    </>
  )
}
