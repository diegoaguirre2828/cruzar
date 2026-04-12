// Points system for community contributions

export const POINTS = {
  report_submitted: 5,
  report_with_wait_time: 10,  // bonus for including actual minutes
  report_upvoted: 2,          // per upvote received
  just_crossed: 8,
  first_report_of_day: 15,    // first report at a crossing each day
  waiting_mode_bonus: 5,      // extra points when reporting from the crossing (geolocation)
  referral_signup: 15,        // referrer earns when referred user signs up
  referral_report: 10,        // referrer earns when referred user submits first report
} as const

export const BADGES: Record<string, { label: string; emoji: string; threshold: number; description: string }> = {
  founder:         { label: 'Fundador / Founder', emoji: '🏅', threshold: 0,    description: 'One of the first 50 Cruzar members — this badge can never be earned again' },
  first_cross:     { label: 'First Cross',       emoji: '🌉', threshold: 1,    description: 'Submitted your first report' },
  regular:         { label: 'Regular',            emoji: '🔁', threshold: 10,   description: '10 reports submitted' },
  veteran:         { label: 'Border Veteran',     emoji: '⭐', threshold: 50,   description: '50 reports submitted' },
  expert:          { label: 'Crossing Expert',    emoji: '🏆', threshold: 100,  description: '100 reports submitted' },
  legend:          { label: 'Border Legend',      emoji: '👑', threshold: 500,  description: '500 reports submitted' },
  helpful:         { label: 'Helpful',            emoji: '👍', threshold: 25,   description: '25 upvotes received' },
  trusted:         { label: 'Trusted Reporter',   emoji: '✅', threshold: 100,  description: '100 upvotes received' },
}

export function getBadgesForProfile(reportsCount: number, totalUpvotesReceived: number): string[] {
  const earned: string[] = []
  if (reportsCount >= 1)   earned.push('first_cross')
  if (reportsCount >= 10)  earned.push('regular')
  if (reportsCount >= 50)  earned.push('veteran')
  if (reportsCount >= 100) earned.push('expert')
  if (reportsCount >= 500) earned.push('legend')
  if (totalUpvotesReceived >= 25)  earned.push('helpful')
  if (totalUpvotesReceived >= 100) earned.push('trusted')
  return earned
}
