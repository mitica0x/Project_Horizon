// Competitor awareness layer. Static profiles + a deterministic assessment
// function. Structured so a live-data source can replace `assessCompetitors`
// later without any frontend change (same return shape).

import type { RadarEvent, UserConstraints } from './types'

export type CompetitorProfile = {
  id: string
  name: string
  shortName: string
  categoryAffinity: Array<'sports' | 'web3' | 'esports' | 'culture' | 'finance'>
  knownSponsors: string[]
  activationStyle: Array<'content' | 'paid' | 'partner' | 'onsite'>
  aggressiveness: 'high' | 'medium' | 'low'
  geoFocus: string[]
  notes: string
}

export const COMPETITORS: CompetitorProfile[] = [
  {
    id: 'binance',
    name: 'Binance',
    shortName: 'BNB',
    categoryAffinity: ['sports', 'esports', 'culture'],
    knownSponsors: ['Champions League', 'Lazio', 'Santos FC', 'Alpine F1'],
    activationStyle: ['partner', 'onsite', 'paid'],
    aggressiveness: 'high',
    geoFocus: ['global', 'Europe', 'SEA'],
    notes: 'Largest activation budget. Broad sports DNA. No current F1 title sponsor.',
  },
  {
    id: 'okx',
    name: 'OKX',
    shortName: 'OKX',
    categoryAffinity: ['sports', 'esports', 'culture'],
    knownSponsors: ['McLaren F1', 'Manchester City', 'EuroLeague'],
    activationStyle: ['partner', 'onsite', 'paid', 'content'],
    aggressiveness: 'high',
    geoFocus: ['Europe', 'UK', 'Asia'],
    notes: 'McLaren title sponsor — expect activation at every F1 race. Strong paid social in EU.',
  },
  {
    id: 'bitget',
    name: 'Bitget',
    shortName: 'BTG',
    categoryAffinity: ['esports', 'sports', 'culture'],
    knownSponsors: ['Juventus', 'PGL esports', 'Lionel Messi'],
    activationStyle: ['partner', 'paid', 'content'],
    aggressiveness: 'medium',
    geoFocus: ['Europe', 'LATAM', 'Asia'],
    notes: 'Rising aggression in EU. Strong esports presence. Juventus partnership active.',
  },
  {
    id: 'kraken',
    name: 'Kraken',
    shortName: 'KRK',
    categoryAffinity: ['sports', 'culture'],
    knownSponsors: ['UFC', 'Everton FC'],
    activationStyle: ['partner', 'onsite'],
    aggressiveness: 'medium',
    geoFocus: ['US', 'UK', 'Europe'],
    notes: 'UFC and football focused. Less aggressive in crypto-native events.',
  },
  {
    id: 'coinbase',
    name: 'Coinbase',
    shortName: 'CB',
    categoryAffinity: ['sports', 'finance', 'culture'],
    knownSponsors: ['NBA', 'Super Bowl'],
    activationStyle: ['paid', 'partner'],
    aggressiveness: 'medium',
    geoFocus: ['US'],
    notes: 'Primarily US-focused. Limited EU activation. Low threat in European events.',
  },
]

export type CompetitorAssessment = {
  competitor: CompetitorProfile
  likelyActivated: boolean
  confidence: 'high' | 'medium' | 'low'
  activationTypes: Array<'content' | 'paid' | 'partner' | 'onsite'>
  signal: string
  threat: 'high' | 'medium' | 'low' | 'none'
  source: 'known_sponsor' | 'category_pattern' | 'geo_match' | 'inferred'
}

type AffinityCat = CompetitorProfile['categoryAffinity'][number]

// RadarEvent.cat is sports|web3|business|cultural; the affinity vocabulary is
// sports|web3|esports|culture|finance. Map across the two.
function affinityFor(cat: RadarEvent['cat']): AffinityCat {
  switch (cat) {
    case 'sports':   return 'sports'
    case 'web3':     return 'web3'
    case 'cultural': return 'culture'
    case 'business': return 'finance'
  }
}

// Loosely resolve an event's freeform geo string into region tokens that can
// be compared against a profile's geoFocus list.
function regionTokens(geo: string): string[] {
  const g = geo.toLowerCase()
  if (g.includes('global')) return ['global', 'europe', 'uk', 'us', 'asia', 'sea', 'latam']
  const out = new Set<string>()
  if (/\b(uk|united kingdom|england|london|britain)\b/.test(g)) { out.add('uk'); out.add('europe') }
  if (/\b(us|usa|united states|america|new york|miami|vegas|texas)\b/.test(g)) out.add('us')
  if (/\b(monaco|france|germany|spain|italy|portugal|czech|prague|netherlands|amsterdam|europe|barcelona|paris|berlin|austria|switzerland|belgium)\b/.test(g)) out.add('europe')
  if (/\b(singapore|hong kong|japan|korea|china|asia|dubai|uae|abu dhabi|thailand|india)\b/.test(g)) out.add('asia')
  if (/\b(sea|south.?east asia|indonesia|vietnam|philippines|malaysia)\b/.test(g)) { out.add('sea'); out.add('asia') }
  if (/\b(latam|brazil|argentina|mexico|chile|colombia)\b/.test(g)) out.add('latam')
  return [...out]
}

const F1_RX = /\b(grand prix|formula\s*1|\bf1\b)\b/i

function isF1Event(event: RadarEvent): boolean {
  return (event.tags ?? []).includes('f1') || F1_RX.test(event.name)
}

function bump(c: 'high' | 'medium' | 'low'): 'high' | 'medium' | 'low' {
  return c === 'low' ? 'medium' : c === 'medium' ? 'high' : 'high'
}

export function assessCompetitors(
  event: RadarEvent,
  _constraints: UserConstraints,
): CompetitorAssessment[] {
  const eventAffinity = affinityFor(event.cat)
  const evRegions = regionTokens(event.geo)
  const eventIsF1 = isF1Event(event)

  return COMPETITORS.map((c): CompetitorAssessment => {
    const geoMatch =
      c.geoFocus.some(g => g.toLowerCase() === 'global') ||
      c.geoFocus.some(g => evRegions.includes(g.toLowerCase()))

    // 1 — known sponsor. Exact event/sponsor name match, plus the F1 linkage
    // (a `… F1` sponsor implies presence at every F1 race) — the spec's
    // verification expects OKX→F1 to read as a known sponsor even though no
    // race is literally named "McLaren F1".
    const exactSponsor = c.knownSponsors.find(
      s => s.toLowerCase() === event.name.toLowerCase(),
    )
    const f1Sponsor = eventIsF1
      ? c.knownSponsors.find(s => /\bf1\b/i.test(s))
      : undefined
    const sponsorHit = exactSponsor ?? f1Sponsor

    const categoryMatch = c.categoryAffinity.includes(eventAffinity)

    let likelyActivated: boolean
    let confidence: CompetitorAssessment['confidence']
    let source: CompetitorAssessment['source']
    let signal: string

    if (sponsorHit) {
      likelyActivated = true
      confidence = 'high'
      source = 'known_sponsor'
      signal = `Sponsors ${sponsorHit} — expect on-site + paid activation at this event.`
    } else if (categoryMatch && c.aggressiveness === 'high') {
      likelyActivated = true
      confidence = 'medium'
      source = 'category_pattern'
      signal = `Activates aggressively in ${eventAffinity} — likely ${c.activationStyle.slice(0, 2).join(' + ')}.`
    } else if (categoryMatch && c.aggressiveness === 'medium') {
      likelyActivated = false
      confidence = 'low'
      source = 'inferred'
      signal = `Category fit but selective — possible ${c.activationStyle[0]}, not guaranteed.`
    } else if (categoryMatch) {
      // low aggressiveness with category fit — unspecified by the rules;
      // treat as unlikely / low-confidence inference.
      likelyActivated = false
      confidence = 'low'
      source = 'inferred'
      signal = `Low-aggression profile — unlikely to prioritise this.`
    } else if (geoMatch) {
      likelyActivated = false
      confidence = 'low'
      source = 'geo_match'
      signal = `In-market (${c.geoFocus.join('/')}) but no category fit — opportunistic at best.`
    } else {
      likelyActivated = false
      confidence = 'low'
      source = 'inferred'
      signal = `Outside core focus — no activation expected.`
    }

    // Geo focus boosts confidence one level.
    if (geoMatch) confidence = bump(confidence)

    const threat: CompetitorAssessment['threat'] = !likelyActivated
      ? 'none'
      : confidence === 'high'
        ? 'high'
        : confidence === 'medium'
          ? 'medium'
          : 'low'

    return {
      competitor: c,
      likelyActivated,
      confidence,
      activationTypes: c.activationStyle,
      signal,
      threat,
      source,
    }
  })
}
