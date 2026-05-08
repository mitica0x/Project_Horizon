export function computeThreatScore(competitorName, siteData, gapsT1, gapsT2) {
  let score = 0

  const pagesPresent = siteData.filter(s =>
    (s.competitors || [])
    .some(c => c.toLowerCase() === competitorName.toLowerCase())
  )
  score += pagesPresent.length * 3

  const t1Pages = gapsT1.filter(g =>
    (g.competitors || [])
    .some(c => c.toLowerCase() === competitorName.toLowerCase())
  )
  score += t1Pages.length * 5

  const cardPages = pagesPresent.filter(s => s.card)
  score += cardPages.length * 4

  const priorityMarkets = ['DE','NL','GB','FR']
  const priorityPages = pagesPresent.filter(s =>
    priorityMarkets.includes(s.country)
  )
  score += priorityPages.length * 2

  return {
    name: competitorName,
    score,
    pagesPresent: pagesPresent.length,
    t1GapPages: t1Pages.length,
    cardPages: cardPages.length,
    priorityPages: priorityPages.length,
    urls: pagesPresent.map(s => s.url),
    t1Urls: t1Pages.map(g => g.url),
    cardUrls: cardPages.map(s => s.url),
    priorityMarket: priorityPages.length > 0
      ? priorityPages[0].country
      : null
  }
}

export function buildHookSentence(threatData) {
  if (threatData.t1GapPages > 0 && threatData.cardPages > 0)
    return `Occupies ${threatData.t1GapPages} T1 gap${threatData.t1GapPages > 1 ? 's' : ''} including ${threatData.cardPages} card page${threatData.cardPages > 1 ? 's' : ''} — see where`
  if (threatData.t1GapPages > 0)
    return `Blocks Bybit on ${threatData.t1GapPages} priority gap${threatData.t1GapPages > 1 ? 's' : ''} — click to see which`
  if (threatData.cardPages > 0)
    return `Present on ${threatData.cardPages} card comparison page${threatData.cardPages > 1 ? 's' : ''} Bybit is missing`
  if (threatData.priorityPages > 0)
    return `Active in ${threatData.priorityMarket} — ${threatData.pagesPresent} page${threatData.pagesPresent > 1 ? 's' : ''} tracked`
  if (threatData.pagesPresent > 0)
    return `Present on ${threatData.pagesPresent} tracked page${threatData.pagesPresent > 1 ? 's' : ''} — no direct T1 conflict`
  return `No presence detected on tracked pages yet`
}

export function getThreatColor(score, maxScore) {
  const r = maxScore > 0 ? score / maxScore : 0
  if (score === 0)  return null
  if (r < 0.15)     return '#7B5EA7'
  if (r < 0.35)     return '#9B6FC7'
  if (r < 0.55)     return '#f59e0b'
  if (r < 0.75)     return '#00d4e8'
  return '#60a5fa'
}

export function getThreatEmissiveIntensity(score, maxScore) {
  const ratio = maxScore > 0 ? score / maxScore : 0
  if (score === 0)   return 0
  if (ratio < 0.15)  return 0.05
  if (ratio < 0.35)  return 0.12
  if (ratio < 0.55)  return 0.22
  if (ratio < 0.75)  return 0.45
  return 0.85
}
