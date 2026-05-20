// Mock /api/scan/latest payload + paired prior-snapshot for UI testing.
//
// Loaded by the T-key shortcut in App.jsx. Bypasses the real scan: no fetch,
// no polling, no backend cost, no scanState transitions. Deterministic state
// that exercises every VS LAST SCAN tab + the dashboard.
//
// MOCK_SCAN mirrors the exact shape returned by /api/scan/latest so it flows
// through the existing `transformScan(payload)` pipeline — same code path
// the real scan uses, so the UI sees an identical scanData object.
//
// MOCK_PREV_SNAPSHOT is what ScanResultsPanel reads from localStorage to
// produce the diff. Hand-tuned so the deltas match the spec:
//   SCORE  +4   (current 64, prev 60)
//   GAPS   +1 opened, +1 resolved
//   WINS   +2
//   ALERTS +1

// LocalStorage key — must match SNAPSHOT_KEY inside ScanResultsPanel.jsx.
// Re-exported here so App.jsx doesn't reach into a component for the constant.
export const SNAPSHOT_KEY = 'horizon_last_scan_snapshot'

const NOW = new Date().toISOString()
const DAY_MS = 86_400_000
const SEVEN_DAYS_AGO = new Date(Date.now() - 7 * DAY_MS).toISOString()

// 24 tracked rows · 3 T1 gaps · 2 wins · 1 brand-safety adjacency (Revolut on
// a gap row drives the brandAlerts count in the dashboard derivation).
export const MOCK_SCAN = {
  org_id: 'mock-org',
  scanned_at: NOW,
  total_tracked: 24,
  canonical_source: 'mock',
  verified: 22,
  score: 64,
  threat_score: 36,
  t1_gaps: 3,
  wins_this_scan: 3,
  competitorCounts: {
    Binance: 18,
    Coinbase: 14,
    Kraken: 11,
    'Crypto.com': 9,
    OKX: 8,
    Bitpanda: 5,
    Revolut: 4,
    Bitget: 3,
  },
  results: [
    // ── T1 GAPS (Bybit absent) ──────────────────────────────────────────────
    {
      url: 'https://finder.com/uk/crypto-exchanges',
      path: '/uk/crypto-exchanges',
      geo: 'UK', tier: 'T1',
      bybit_present: false,
      competitors_present: ['Binance', 'Coinbase', 'Kraken', 'Crypto.com'],
      opp_score: 82,
      status: 'success',
      scanned_at: NOW,
    },
    {
      url: 'https://investopedia.com/best-crypto-exchanges-and-apps-5093685',
      path: '/best-crypto-exchanges-and-apps-5093685',
      geo: 'Global', tier: 'T1',
      bybit_present: false,
      competitors_present: ['Binance', 'Coinbase', 'Kraken'],
      opp_score: 78,
      status: 'success',
      scanned_at: NOW,
    },
    {
      url: 'https://moneysavingexpert.com/savings/cheap-crypto',
      path: '/savings/cheap-crypto',
      geo: 'UK', tier: 'T1',
      bybit_present: false,
      // Revolut here drives the brand-alert (Revolut listed, Bybit absent).
      competitors_present: ['Revolut', 'Coinbase', 'Binance'],
      opp_score: 88,
      status: 'success',
      scanned_at: NOW,
    },

    // ── T2 GAP ──────────────────────────────────────────────────────────────
    {
      url: 'https://btc-echo.de/reviews/vergleich/krypto-boersen-und-broker',
      path: '/reviews/vergleich/krypto-boersen-und-broker',
      geo: 'EU', tier: 'T2',
      bybit_present: false,
      competitors_present: ['Binance', 'Bitpanda', 'Kraken'],
      opp_score: 58,
      status: 'success',
      scanned_at: NOW,
    },

    // ── WINS (Bybit listed) ─────────────────────────────────────────────────
    {
      url: 'https://forbes.com/advisor/investing/cryptocurrency/best-crypto-exchanges',
      path: '/advisor/investing/cryptocurrency/best-crypto-exchanges',
      geo: 'Global', tier: 'T1',
      bybit_present: true,
      competitors_present: ['Bybit', 'Binance', 'Coinbase', 'Kraken'],
      opp_score: 30,
      status: 'success',
      scanned_at: NOW,
    },
    {
      url: 'https://decrypt.co/reviews/exchanges/bybit-review',
      path: '/reviews/exchanges/bybit-review',
      geo: 'Global', tier: 'T1',
      bybit_present: true,
      competitors_present: ['Bybit'],
      opp_score: 0,
      status: 'success',
      scanned_at: NOW,
    },
    {
      url: 'https://cryptoradar.com/en/exchanges',
      path: '/en/exchanges',
      geo: 'EU', tier: 'T2',
      bybit_present: true,
      competitors_present: ['Bybit', 'Binance', 'Kraken', 'OKX'],
      opp_score: 25,
      status: 'success',
      scanned_at: NOW,
    },

    // ── Mix of T2/T3 confirmed presence (volume for competitor counts) ──────
    {
      url: 'https://nerdwallet.com/best/investing/crypto-exchanges-platforms',
      path: '/best/investing/crypto-exchanges-platforms',
      geo: 'Global', tier: 'T1',
      bybit_present: true,
      competitors_present: ['Bybit', 'Coinbase', 'Kraken', 'Crypto.com'],
      opp_score: 0,
      status: 'success',
      scanned_at: NOW,
    },
    {
      url: 'https://coingecko.com/en/exchanges',
      path: '/en/exchanges',
      geo: 'Global', tier: 'T1',
      bybit_present: true,
      competitors_present: ['Bybit', 'Binance', 'Coinbase', 'OKX', 'Bitget'],
      opp_score: 0,
      status: 'success',
      scanned_at: NOW,
    },
  ],
}

// Prior snapshot — written to localStorage before scanData is committed so
// ScanResultsPanel diffs against this instead of synthesising one.
//
// Computed from MOCK_SCAN's derived shape:
//   curr.score        = 64 → prev = 60   →  +4 scoreDelta
//   curr.tier1Gaps    = 3  → prev = 2    →  +1 gapsDelta (Bybit lost ground)
//   curr.wins         = 4  → prev = 2    →  +2 winsDelta
//   curr.brandAlerts  = 1  → prev = 0    →  +1 alertsDelta
//
// `gaps` is the prior-known gap list. Including one entry that's NOT in the
// current scan ("uswitch.com/uk/exchanges") gives GAPS RESOLVED a row.
// Including all current gaps EXCEPT the newest ("finder.com/uk/crypto-exchanges")
// in prev means finder shows up in NEW GAPS OPENED.
export const MOCK_PREV_SNAPSHOT = {
  score: 60,
  tier1Gaps: 2,
  brandAlerts: 0,
  wins: 2,
  scannedAt: SEVEN_DAYS_AGO,
  gaps: [
    // Carried over from prev → also in current → unchanged
    {
      domain: 'investopedia.com',
      path: '/best-crypto-exchanges-and-apps-5093685',
      tier: 'T1', severity: 'high', country: 'Global', geo: 'GLOBAL',
    },
    {
      domain: 'moneysavingexpert.com',
      path: '/savings/cheap-crypto',
      tier: 'T1', severity: 'high', country: 'UK', geo: 'UK',
    },
    {
      domain: 'btc-echo.de',
      path: '/reviews/vergleich/krypto-boersen-und-broker',
      tier: 'T2', severity: 'medium', country: 'EU', geo: 'EU',
    },
    // Was a gap last scan, Bybit now listed → GAPS RESOLVED row
    {
      domain: 'uswitch.com',
      path: '/uk/crypto-exchanges',
      tier: 'T1', severity: 'high', country: 'UK', geo: 'UK',
    },
  ],
  // Per-competitor blocked-gap counts at prev. Lower numbers than current
  // give competitor-momentum-positive movement (more blocks now = competitor
  // gained ground).
  competitors: [
    { name: 'Binance', blocksOnGaps: 2 },
    { name: 'Coinbase', blocksOnGaps: 2 },
    { name: 'Kraken', blocksOnGaps: 1 },
    { name: 'Crypto.com', blocksOnGaps: 1 },
    { name: 'Bitpanda', blocksOnGaps: 0 },
    { name: 'Revolut', blocksOnGaps: 0 },
    { name: 'OKX', blocksOnGaps: 0 },
    { name: 'Bitget', blocksOnGaps: 0 },
  ],
  // First-seen timestamps so GAPS RESOLVED can render "gap open Xd"
  gapAges: {
    'uswitch.com/uk/crypto-exchanges': new Date(Date.now() - 24 * DAY_MS).toISOString(),
    'investopedia.com/best-crypto-exchanges-and-apps-5093685': new Date(Date.now() - 18 * DAY_MS).toISOString(),
    'moneysavingexpert.com/savings/cheap-crypto': new Date(Date.now() - 12 * DAY_MS).toISOString(),
    'btc-echo.de/reviews/vergleich/krypto-boersen-und-broker': new Date(Date.now() - 9 * DAY_MS).toISOString(),
  },
}
