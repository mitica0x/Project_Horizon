import type { RadarEvent } from './types'

export const RADAR_EVENTS: RadarEvent[] = [
  {
    id: 1,
    name: "Bitcoin Pizza Day",
    date: "2026-05-22",
    geo: "Global",
    cat: "web3",
    sub: "First real-world Bitcoin transaction anniversary — crypto-native cultural moment",
    score: 8,
    pri: "high",
    tags: ["bitcoin", "culture", "crypto-native"]
  },
  {
    id: 2,
    name: "Monaco Grand Prix",
    date: "2026-06-07",
    geo: "Monaco",
    cat: "sports",
    sub: "F1 street circuit — wealth, speed, luxury, 200k+ crowd",
    score: 9,
    pri: "high",
    tags: ["f1", "motorsport", "luxury", "high-net-worth"]
  },
  {
    id: 3,
    name: "BTC Prague",
    date: "2026-06-11",
    geo: "Prague, Czech Republic",
    cat: "web3",
    sub: "Europe's largest Bitcoin-only conference — 10,000+ attendees, 200+ speakers",
    score: 8,
    pri: "high",
    tags: ["bitcoin", "czech-republic", "institutional", "maximalist"]
  },
  {
    id: 4,
    name: "Barcelona Grand Prix",
    date: "2026-06-14",
    geo: "Barcelona, Spain",
    cat: "sports",
    sub: "F1 at Circuit de Barcelona-Catalunya — strong Spanish and European audience",
    score: 7,
    pri: "medium",
    tags: ["f1", "motorsport", "spain", "europe"]
  },
  {
    id: 5,
    name: "Web3 Summit Berlin",
    date: "2026-06-18",
    geo: "Berlin, Germany",
    cat: "web3",
    sub: "Web3 Foundation flagship event — festival format, builders, researchers, founders",
    score: 7,
    pri: "medium",
    tags: ["web3", "defi", "builders", "germany"]
  },
  {
    id: 6,
    name: "IEM Cologne CS2 Major",
    date: "2026-06-18",
    geo: "Cologne, Germany",
    cat: "sports",
    sub: "Counter-Strike 2 Major — $1.25M prize pool, 50,000+ live attendees over event",
    score: 9,
    pri: "high",
    tags: ["esports", "gaming", "cs2", "germany"]
  },
  {
    id: 7,
    name: "Austrian Grand Prix",
    date: "2026-06-28",
    geo: "Spielberg, Austria",
    cat: "sports",
    sub: "F1 Red Bull Ring — young European crowd, festival atmosphere, 300k weekend",
    score: 8,
    pri: "high",
    tags: ["f1", "motorsport", "austria", "festival"]
  },
  {
    id: 9,
    name: "British Grand Prix",
    date: "2026-07-05",
    geo: "Silverstone, UK",
    cat: "sports",
    sub: "F1 Silverstone with Sprint — 400k+ crowd, biggest single-sport UK event",
    score: 8,
    pri: "high",
    tags: ["f1", "motorsport", "uk", "sprint"]
  },
  {
    id: 8,
    name: "Esports World Cup",
    date: "2026-07-06",
    geo: "Paris, France",
    cat: "sports",
    sub: "Multi-title esports — CS2, LoL, Valorant, $75M prize pool, moved to Paris for 2026",
    score: 8,
    pri: "high",
    tags: ["esports", "gaming", "france", "multi-title"]
  },
  {
    id: 10,
    name: "MotoGP German Grand Prix",
    date: "2026-07-10",
    geo: "Sachsenring, Germany",
    cat: "sports",
    sub: "MotoGP at Sachsenring — 200k weekend crowd, male-skewed, speed and risk culture",
    score: 7,
    pri: "medium",
    tags: ["motogp", "motorsport", "germany", "male-audience"]
  },
  {
    id: 11,
    name: "Tomorrowland",
    date: "2026-07-17",
    geo: "Boom, Belgium",
    cat: "cultural",
    sub: "World's largest EDM festival — 400k across 2 weekends, male 20-35, crypto-friendly",
    score: 7,
    pri: "medium",
    tags: ["festival", "edm", "belgium", "lifestyle"]
  },
  {
    id: 12,
    name: "Belgian Grand Prix",
    date: "2026-07-19",
    geo: "Spa-Francorchamps, Belgium",
    cat: "sports",
    sub: "F1 Spa with Sprint — legendary circuit, massive European audience, festival camping",
    score: 8,
    pri: "high",
    tags: ["f1", "motorsport", "belgium", "sprint"]
  },
  {
    id: 13,
    name: "Hungarian Grand Prix",
    date: "2026-07-26",
    geo: "Budapest, Hungary",
    cat: "sports",
    sub: "F1 Budapest — last race before summer break, strong CEE audience",
    score: 7,
    pri: "medium",
    tags: ["f1", "motorsport", "hungary", "cee"]
  },
  {
    id: 14,
    name: "EPT Barcelona",
    date: "2026-08-16",
    geo: "Barcelona, Spain",
    cat: "sports",
    sub: "Largest EPT stop — 2,000+ poker players, high-stakes risk culture, strong crypto crossover",
    score: 8,
    pri: "high",
    tags: ["poker", "high-stakes", "spain", "barcelona"]
  },
  {
    id: 15,
    name: "Dutch Grand Prix",
    date: "2026-08-23",
    geo: "Zandvoort, Netherlands",
    cat: "sports",
    sub: "F1 Zandvoort final ever edition with Sprint — sold-out, passionate Dutch crowd",
    score: 9,
    pri: "high",
    tags: ["f1", "motorsport", "netherlands", "sprint"]
  },
  {
    id: 16,
    name: "Gamescom Cologne",
    date: "2026-08-26",
    geo: "Cologne, Germany",
    cat: "sports",
    sub: "Europe's largest gaming event — 370k+ attendees, 18-35 male, high crypto adoption",
    score: 9,
    pri: "high",
    tags: ["gaming", "esports", "germany", "consumer"]
  },
  {
    id: 17,
    name: "Italian Grand Prix",
    date: "2026-09-06",
    geo: "Monza, Italy",
    cat: "sports",
    sub: "F1 Monza — oldest GP on calendar, tifosi culture, 150k+ crowd, huge media reach",
    score: 7,
    pri: "medium",
    tags: ["f1", "motorsport", "italy", "heritage"]
  },
  {
    id: 18,
    name: "Madrid Grand Prix",
    date: "2026-09-13",
    geo: "Madrid, Spain",
    cat: "sports",
    sub: "F1 Madrid debut — brand new street circuit, massive Spanish media, 200k+ expected",
    score: 8,
    pri: "high",
    tags: ["f1", "motorsport", "spain", "debut"]
  },
  {
    id: 19,
    name: "CONF3RENCE Dortmund",
    date: "2026-09-15",
    geo: "Dortmund, Germany",
    cat: "web3",
    sub: "Web3 + AI conference at Signal Iduna Park — B2B day plus public day format",
    score: 8,
    pri: "high",
    tags: ["web3", "ai", "germany", "exchange"]
  },
  {
    id: 20,
    name: "European Blockchain Convention",
    date: "2026-09-16",
    geo: "Barcelona, Spain",
    cat: "web3",
    sub: "12th edition — 6,000+ attendees, BlackRock, Bitwise, institutional focus",
    score: 8,
    pri: "high",
    tags: ["web3", "institutional", "spain", "exchange"]
  },
  {
    id: 21,
    name: "Baku Grand Prix",
    date: "2026-09-26",
    geo: "Baku, Azerbaijan",
    cat: "sports",
    sub: "F1 street circuit Saturday race — strong CIS and Eastern European audience overlap",
    score: 7,
    pri: "medium",
    tags: ["f1", "motorsport", "azerbaijan", "cee"]
  },
  {
    id: 22,
    name: "Singapore Grand Prix",
    date: "2026-10-11",
    geo: "Singapore",
    cat: "sports",
    sub: "F1 Singapore with Sprint — night race, Asia-Pacific crypto hub, premium audience",
    score: 7,
    pri: "medium",
    tags: ["f1", "motorsport", "singapore", "asia-pacific"]
  },
  {
    id: 23,
    name: "AI Expo Europe",
    date: "2026-11-01",
    geo: "Bucharest, Romania",
    cat: "web3",
    sub: "Eastern Europe's largest AI conference — Radisson Blu, AI x crypto crossover audience",
    score: 9,
    pri: "high",
    tags: ["ai", "crypto", "romania", "eastern-europe"]
  },
  {
    id: 24,
    name: "Web Summit Lisbon",
    date: "2026-11-09",
    geo: "Lisbon, Portugal",
    cat: "web3",
    sub: "World's largest tech conference — 70,000+ attendees, major Web3 and crypto tracks",
    score: 8,
    pri: "high",
    tags: ["web3", "tech", "portugal", "institutional"]
  }
]
