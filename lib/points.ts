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
  auto_geofence_crossing: 10, // confirmed auto-detected bridge crossing
} as const

export interface Badge {
  labelEs: string
  labelEn: string
  emoji: string
  threshold: number
  descriptionEs: string
  descriptionEn: string
  /** @deprecated read labelEs / labelEn instead — kept for legacy callers */
  label: string
  /** @deprecated read descriptionEs / descriptionEn instead — kept for legacy callers */
  description: string
}

export const BADGES: Record<string, Badge> = {
  founder: {
    labelEs: 'Fundador',                labelEn: 'Founder',
    emoji: '🏅', threshold: 0,
    descriptionEs: 'Uno de los primeros 50 miembros de Cruzar — esta insignia ya no se puede ganar',
    descriptionEn: 'One of the first 50 Cruzar members — this badge can never be earned again',
    label: 'Fundador / Founder',
    description: 'One of the first 50 Cruzar members — this badge can never be earned again',
  },
  first_cross: {
    labelEs: 'Primer cruce',            labelEn: 'First Cross',
    emoji: '🌉', threshold: 1,
    descriptionEs: 'Enviaste tu primer reporte',
    descriptionEn: 'Submitted your first report',
    label: 'First Cross',
    description: 'Submitted your first report',
  },
  regular: {
    labelEs: 'Habitual',                labelEn: 'Regular',
    emoji: '🔁', threshold: 10,
    descriptionEs: '10 reportes enviados',
    descriptionEn: '10 reports submitted',
    label: 'Regular',
    description: '10 reports submitted',
  },
  veteran: {
    labelEs: 'Veterano fronterizo',     labelEn: 'Border Veteran',
    emoji: '⭐', threshold: 50,
    descriptionEs: '50 reportes enviados',
    descriptionEn: '50 reports submitted',
    label: 'Border Veteran',
    description: '50 reports submitted',
  },
  expert: {
    labelEs: 'Experto del cruce',       labelEn: 'Crossing Expert',
    emoji: '🏆', threshold: 100,
    descriptionEs: '100 reportes enviados',
    descriptionEn: '100 reports submitted',
    label: 'Crossing Expert',
    description: '100 reports submitted',
  },
  legend: {
    labelEs: 'Leyenda fronteriza',      labelEn: 'Border Legend',
    emoji: '👑', threshold: 500,
    descriptionEs: '500 reportes enviados',
    descriptionEn: '500 reports submitted',
    label: 'Border Legend',
    description: '500 reports submitted',
  },
  helpful: {
    labelEs: 'Servicial',               labelEn: 'Helpful',
    emoji: '👍', threshold: 25,
    descriptionEs: '25 votos positivos recibidos',
    descriptionEn: '25 upvotes received',
    label: 'Helpful',
    description: '25 upvotes received',
  },
  trusted: {
    labelEs: 'Reportero confiable',     labelEn: 'Trusted Reporter',
    emoji: '✅', threshold: 100,
    descriptionEs: '100 votos positivos recibidos',
    descriptionEn: '100 upvotes received',
    label: 'Trusted Reporter',
    description: '100 upvotes received',
  },
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
