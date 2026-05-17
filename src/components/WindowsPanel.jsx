import { PanelHeader, EmptyState } from './horizonUI'

// Stub — real implementation lands in P3.
export default function WindowsPanel() {
  return (
    <>
      <PanelHeader title="Predictive Windows" accent="#00d4e8" sub="Next 90 days" />
      <EmptyState>Module activates in P3</EmptyState>
    </>
  )
}
