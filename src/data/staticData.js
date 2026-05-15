export const SCORE = 52
export const PAGES_PRESENT = 13
export const PAGES_TRACKED = 25

export const COMPETITOR_COLORS = {
  // Tier 1 — instant alert
  Revolut:       '#60a5fa',
  'Crypto.com':  '#00d4e8',
  Bitpanda:      '#f97316',
  Coinbase:      '#1652F0',
  // Tier 2 — weekly digest
  Binance:       '#7B5EA7',
  Kraken:        '#D4A853',
  OKX:           '#8892a4',
  'Trading 212': '#00d26a',
  KuCoin:        '#2ecc71',
  'KuCoin EU':   '#27ae60',
  Bitget:        '#00b4d8',
  // Tier 3 — monthly context
  MEXC:          '#2354e6',
  WhiteBit:      '#6b7280',
  BingX:         '#7B5EA7',
}

export const COMPETITORS = [
  { name: 'Revolut',      count: 10, color: '#60a5fa', tier: 1 },
  { name: 'Kraken',       count: 9,  color: '#D4A853', tier: 2 },
  { name: 'Binance',      count: 8,  color: '#7B5EA7', tier: 2 },
  { name: 'Crypto.com',   count: 5,  color: '#00d4e8', tier: 1 },
  { name: 'OKX',          count: 3,  color: '#8892a4', tier: 2 },
  { name: 'Bitget',       count: 3,  color: '#00b4d8', tier: 2 },
  { name: 'Coinbase',     count: 2,  color: '#1652F0', tier: 1 },
  { name: 'Bitpanda',     count: 0,  color: '#f97316', tier: 1 },
  { name: 'Trading 212',  count: 0,  color: '#00d26a', tier: 2 },
  { name: 'KuCoin',       count: 0,  color: '#2ecc71', tier: 2 },
  { name: 'KuCoin EU',    count: 0,  color: '#27ae60', tier: 2 },
  { name: 'MEXC',         count: 0,  color: '#2354e6', tier: 3 },
  { name: 'WhiteBit',     count: 0,  color: '#6b7280', tier: 3 },
  { name: 'BingX',        count: 0,  color: '#7B5EA7', tier: 3 },
]

export const GAPS_T1 = [
  { url: 'finder.com/cryptocurrency/exchanges',             domain: 'finder.com',            competitors: ['Crypto.com','OKX','Kraken'],   country: 'GLOBAL' },
  { url: 'investopedia.com/best-crypto-exchanges',          domain: 'investopedia.com',      competitors: ['Kraken','Coinbase','Binance'],  country: 'GLOBAL' },
  { url: 'nerdwallet.com/best-crypto-exchange',             domain: 'nerdwallet.com',        competitors: ['Kraken','Revolut'],            country: 'GLOBAL' },
  { url: 'money.co.uk/cryptocurrency',                     domain: 'money.co.uk',           competitors: ['Revolut','Kraken'],            country: 'UK'     },
  { url: 'thisismoney.co.uk/crypto',                       domain: 'thisismoney.co.uk',     competitors: ['Revolut'],                     country: 'UK'     },
  { url: 'moneysavingexpert.com/savings/crypto-exchanges', domain: 'moneysavingexpert.com', competitors: ['Revolut'],                     country: 'UK'     },
  { url: 'comparethemarket.com/investments/crypto',        domain: 'comparethemarket.com',  competitors: ['Revolut','Binance'],           country: 'UK'     },
  { url: 'uswitch.com/personal-finance/crypto',            domain: 'uswitch.com',           competitors: ['Revolut','Crypto.com'],        country: 'UK'     },
  { url: 'finanzfluss.de/kreditkarte/debitkarte',          domain: 'finanzfluss.de',        competitors: ['Revolut'],                     country: 'DE'     },
]

export const GAPS_T2 = [
  { url: 'jeangalea.com/best-crypto-debit-cards-europe', domain: 'jeangalea.com',    competitors: ['Crypto.com'], country: 'EU',     review: true  },
  { url: 'cryptowisser.com/exchanges',                   domain: 'cryptowisser.com', competitors: ['Binance'],   country: 'GLOBAL', review: false },
  { url: 'coincodex.com/best-crypto-exchanges',          domain: 'coincodex.com',    competitors: ['Binance','Kraken'], country: 'GLOBAL', review: false },
]

export const WINS = [
  { url: 'coincierge.de/krypto-boersen-vergleich',                domain: 'coincierge.de',       competitors: ['Revolut'],                    country: 'DE',     card: false, context: 'Bybit ranks third in our comparison of top crypto exchanges.' },
  { url: 'cryptonews.com/exchanges',                              domain: 'cryptonews.com',      competitors: ['Binance','Kraken'],            country: 'GLOBAL', card: false, context: 'Bybit consistently featured among the best crypto exchanges in 2026 for its deep liquidity.' },
  { url: 'blockworks.co',                                         domain: 'blockworks.co',       competitors: ['Revolut'],                    country: 'GLOBAL', card: false, context: 'Spot trading volume rankings - ByBit featured prominently in 24h volume data.' },
  { url: 'tradersunion.com/best-crypto-exchanges/in-europe',      domain: 'tradersunion.com',    competitors: ['Binance','Bitget','Kraken'],   country: 'GLOBAL', card: false, context: 'Bybit.eu - EU-regulated exchange for spot and margin trading with leverage up to 1:2.' },
  { url: 'captainaltcoin.com/best-crypto-exchange',               domain: 'captainaltcoin.com',  competitors: ['Revolut'],                    country: 'GLOBAL', card: false, context: 'Bybit listed in margin trading exchanges alongside Deribit, Bitfinex, and Kraken.' },
  { url: 'datawallet.com/crypto/best-crypto-debit-cards',         domain: 'datawallet.com',      competitors: ['Crypto.com'],                 country: 'GLOBAL', card: true,  context: 'Bybit is the best crypto debit card - up to 10% cashback, works anywhere Visa or Mastercard is accepted.' },
  { url: 'coingecko.com/en/exchanges',                            domain: 'coingecko.com',       competitors: ['Binance','Kraken','Coinbase'], country: 'GLOBAL', card: false, context: 'Bybit Reserve 9/10 - $2.34B verified reserves, ranked #5 by 24h trading volume.' },
  { url: 'cryptotips.eu/en/blog/top-10-cryptocurrency-exchanges', domain: 'cryptotips.eu',       competitors: ['Crypto.com','Binance','OKX'],  country: 'EU',     card: false, context: 'Bybit is one of the largest exchanges with over 1,400 trading pairs on the global platform.' },
  { url: '99bitcoins.com/bitcoin-exchanges',                      domain: '99bitcoins.com',      competitors: ['Binance','Kraken'],            country: 'GLOBAL', card: false, context: '#12 Bybit - Comparing Top Cryptocurrency Exchanges in 2026.' },
  { url: 'hedgewithcrypto.com/best-crypto-exchanges',             domain: 'hedgewithcrypto.com', competitors: ['Binance','Kraken'],            country: 'GLOBAL', card: false, context: 'Bybit earns a top spot for high leverage and deep derivatives markets.' },
  { url: 'kryptoszene.de',                                        domain: 'kryptoszene.de',      competitors: ['Revolut'],                    country: 'DE',     card: false, context: 'ByBit Erfahrungen - comprehensive German-language review and comparison.' },
  { url: 'coinmarketcap.com/rankings/exchanges',                  domain: 'coinmarketcap.com',   competitors: ['Binance','OKX','Coinbase'],    country: 'GLOBAL', card: false, context: '#5 Bybit - $2.32B 24h volume, 655 markets, 1,208 coins available for trading.' },
  { url: 'cryptogeek.info/en/exchanges',                          domain: 'cryptogeek.info',     competitors: ['Binance','Kraken'],            country: 'GLOBAL', card: false, context: 'Bybit reviewed and listed among top-tier exchanges for professional derivatives traders.' },
]

export const TABLE_DATA = [
  ...WINS.map(w  => ({ ...w,  status: 'present', tier: 'Tier 1' })),
  ...GAPS_T1.map(g => ({ ...g, status: 'absent',  tier: 'Tier 1', card: false, context: null })),
  ...GAPS_T2.map(g => ({ ...g, status: 'absent',  tier: 'Tier 2', card: false, context: null })),
]

// Unified deduplicated list of all tracked sites.
// TABLE_DATA spread first so dedup retains entries with status/tier metadata
// rather than the raw GAPS_T1 / GAPS_T2 / WINS variants which lack those fields.
export const ALL_SITES = [...TABLE_DATA, ...GAPS_T1, ...GAPS_T2, ...WINS].filter(
  (site, index, self) => index === self.findIndex(s => s.domain === site.domain)
)
