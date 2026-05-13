import type { RadarEvent, PresenceBrief } from '../../lib/radar/types'

const RADAR_API_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3000'

export async function generatePresenceBrief(event: RadarEvent): Promise<PresenceBrief> {
  const response = await fetch(`${RADAR_API_URL}/api/radar/brief`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`RADAR API error ${response.status}: ${err}`)
  }

  const brief: PresenceBrief = await response.json()
  return brief
}
