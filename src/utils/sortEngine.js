export const CRITERIA = {
  card_pages: {
    label: '🎯 Card Pages',
    description: 'Card comparison pages score higher',
    score: (item) =>
      (item.product_tags || []).includes('Card') ? 10 : 0
  },
  country_priority: {
    label: '🌍 Country Priority',
    description: 'DE, NL, GB, FR score highest',
    score: (item) => {
      const priority = {DE:10, NL:9, GB:8, FR:7, EU:4}
      return priority[item.country] || 1
    }
  },
  competitor_density: {
    label: '⚡ Competitor Density',
    description: 'More competitors present = higher urgency',
    score: (item) =>
      (item.competitors || []).length * 3
  },
  easy_entry: {
    label: '🚪 Easy Entry',
    description: 'Fewer competitors = easier to enter',
    score: (item) =>
      Math.max(0, 10 - (item.competitors || []).length * 2)
  },
  recently_changed: {
    label: '🕐 Recently Changed',
    description: 'Most recently updated pages first',
    score: (item) => {
      if (!item.last_scanned) return 0
      const days = (Date.now() -
        new Date(item.last_scanned)) / 86400000
      return Math.max(0, 10 - days)
    }
  },
  affiliate_ready: {
    label: '💳 Affiliate Ready',
    description: 'Pages with affiliate model score higher',
    score: (item) => item.affiliate ? 10 : 0
  }
}

export function sortItems(items, activeCriteria) {
  if (!activeCriteria || activeCriteria.length === 0)
    return items
  return [...items].sort((a, b) => {
    let scoreA = 0, scoreB = 0
    activeCriteria.forEach((key, index) => {
      const weight = activeCriteria.length - index
      if (CRITERIA[key]) {
        scoreA += CRITERIA[key].score(a) * weight
        scoreB += CRITERIA[key].score(b) * weight
      }
    })
    return scoreB - scoreA
  })
}
