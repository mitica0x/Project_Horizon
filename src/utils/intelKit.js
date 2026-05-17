// Section-aware INTEL priming. Each builder returns { insight, chips }:
// - insight: one flowing read that goes one layer deeper than the visible
//   page data (max ~2 lines, no bullets)
// - chips: 3 smart questions that auto-send when tapped
//
// Callers pass real data from horizonStore/horizonData; where a section has
// no real source yet, callers pass seeded values with the same shape.

const plural = (n, w) => `${n} ${w}${Math.abs(Number(n)) === 1 ? '' : 's'}`

export const intelKit = {
  status: ({ label, days }) => ({
    insight: `Signal has been ${label} for ${plural(days, 'day')}. Historically, extended HIGH PRESSURE periods correlate with competitor over-extension — this can create openings if you move in the next 5–7 days.`,
    chips: [
      "What's driving this pressure?",
      'Where are the openings right now?',
      'What would flip this to ALL CLEAR?',
    ],
  }),

  windows: () => ({
    insight:
      'Your last 3 wins came after periods where you ran 2+ activations in quick succession. Your current activation cadence is lower than those patterns suggest is optimal.',
    chips: [
      'When am I most likely to win next?',
      'What do my win conditions look like?',
      'What should I pause right now?',
    ],
  }),

  outcomes: ({ rate, top, low, line }) => ({
    insight: `Your activation success rate is ${rate}%. The top-performing activations were in ${top}. The lowest were in ${low}. Pattern: ${line}.`,
    chips: [
      'Which activation type should I prioritize?',
      "What's my worst-performing category?",
      'Show me my best win conditions',
    ],
  }),

  ledger: ({ count, pattern }) => ({
    insight: `You've logged ${plural(count, 'decision')}. The decisions with the best downstream outcomes shared a common trait: ${
      pattern || 'more data needed — keep logging'
    }.`,
    chips: [
      'What decisions should I revisit?',
      'Where am I most consistent?',
      'What patterns are emerging?',
    ],
  }),

  signal: ({ days }) => {
    const tail =
      days > 14
        ? ' You may be past the optimal window.'
        : days < 7
        ? " Hold — pattern suggests it's too early."
        : ''
    return {
      insight: `You've held current posture for ${plural(
        days,
        'day',
      )}. Historical pattern: your highest-ROI activations followed posture holds of 7–14 days.${tail}`,
      chips: [
        'Should I flip posture now?',
        'What would justify a change?',
        'What did the last posture flip lead to?',
      ],
    }
  },

  brief: ({ events, moves, gap }) => ({
    insight: `This brief covers ${plural(events, 'event')} and ${plural(
      moves,
      'competitor move',
    )}. Key signal not in the narrative: ${gap}.`,
    chips: [
      "What's missing from this brief?",
      'What should I do in the next 14 days?',
      'Generate client-ready version',
    ],
  }),

  network: ({ nodes, strong, cold, gapRegion }) => ({
    insight: `Your network map has ${plural(
      nodes,
      'node',
    )}. Strongest signal contacts are in ${strong}. Coldest: ${cold}. A gap exists in ${gapRegion} — no warm contacts there.`,
    chips: [
      'Who should I activate next?',
      'Where are my network blind spots?',
      'Who has the highest closability?',
    ],
  }),

  nova: () => ({
    insight:
      'N0VA is your war planning space. Use it when you are facing a time-compressed decision with multiple moving parts. It works best when you define the constraint first.',
    chips: [
      'I need a 30-day activation plan',
      "I'm facing a competitor move — what do I do?",
      'Build a brief for Ionuț',
    ],
  }),

  scan: ({ score, gapName, geo, tier, comps }) => ({
    insight: `Current threat score is ${score}. The highest-leverage move based on gap closability and competitor density is ${gapName} — ${geo}, ${tier}, ${plural(
      comps,
      'competitor',
    )} present.`,
    chips: [
      'Which gap should I close first?',
      'Build me a 30-day plan',
      'What would move my score the most?',
    ],
  }),

  gap: ({ site, geo, tier, comps }) => {
    const list = comps && comps.length ? comps.join(', ') : 'no competitors'
    return {
      insight: `${site} sits in ${tier} / ${geo} where editorial authority compounds — getting listed here is a durable ranking signal, which is exactly why ${list} already appear. The fastest unlock is an outreach angle, not a feature ask.`,
      chips: [
        'How do I get listed here?',
        `Who's the right contact at ${site}?`,
        'Draft an outreach angle',
      ],
    }
  },
}
