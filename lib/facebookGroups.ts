// Target Facebook groups per region — the distribution backbone.
// Shared by the admin panel and the promoter dashboard so both use
// the same canonical list. Add new groups here as they're discovered.

export type FbGroupRegion =
  | 'rgv' | 'brownsville' | 'laredo' | 'eagle_pass' | 'el_paso'
  | 'san_luis' | 'nogales' | 'tijuana' | 'mexicali' | 'other'

export interface FacebookGroup {
  name: string
  region: FbGroupRegion
  url: string
  members?: string
}

export const REGION_LABELS: Record<FbGroupRegion, { label: string; emoji: string }> = {
  rgv:         { label: 'RGV / McAllen / Reynosa',        emoji: '🌵' },
  brownsville: { label: 'Matamoros / Brownsville',         emoji: '🏙️' },
  laredo:      { label: 'Laredo / Nuevo Laredo',           emoji: '🛣️' },
  eagle_pass:  { label: 'Eagle Pass / Piedras Negras',     emoji: '🦅' },
  el_paso:     { label: 'El Paso / Juárez',                emoji: '⛰️' },
  nogales:     { label: 'Nogales / Sonora',                emoji: '🌵' },
  san_luis:    { label: 'San Luis RC / Yuma',              emoji: '☀️' },
  tijuana:     { label: 'Tijuana / San Ysidro / Otay',     emoji: '🌊' },
  mexicali:    { label: 'Mexicali / Calexico / Algodones', emoji: '🏜️' },
  other:       { label: 'Otros',                           emoji: '📍' },
}

export const FACEBOOK_GROUPS: FacebookGroup[] = [
  { name: 'FILAS DE PUENTES ANZALDUAS, HIDALGO, PHARR, DONNA, PROGRESO, INDIOS', region: 'rgv', url: 'https://www.facebook.com/groups/2331786033753528' },
  { name: 'Fila en Puentes Reynosa Hidalgo, Anzalduas y Pharr',                  region: 'rgv', url: 'https://www.facebook.com/groups/630300451147099' },
  { name: 'FILAS DE PUENTES REYNOSA HIDALGO, DONNA, PHARR, ANZALDUAS, PROGRESO', region: 'rgv', url: 'https://www.facebook.com/groups/302019986939323' },
  { name: 'Fila en Puente Reynosa-Hidalgo',                                       region: 'rgv', url: 'https://www.facebook.com/groups/978204527689403' },
  { name: 'Filas de Progreso, Donna, y Los Indios',                               region: 'rgv', url: 'https://www.facebook.com/groups/302878187276542' },
  { name: 'FILA PUENTE LOS INDIOS',                                               region: 'brownsville', url: 'https://www.facebook.com/groups/230659829875807' },
  { name: 'FILA PUENTE LOS INDIOS (2)',                                           region: 'brownsville', url: 'https://www.facebook.com/groups/1731295540981020' },
  { name: 'Fila de Los Puentes Internacionales',                                  region: 'brownsville', url: 'https://www.facebook.com/groups/796522180440318' },
  { name: 'Filas de Puentes Matamoros/Brownsville',                               region: 'brownsville', url: 'https://www.facebook.com/groups/416633560460332' },
  { name: 'Matamoros/Brownsville Bridge Rows',                                    region: 'brownsville', url: 'https://www.facebook.com/groups/3374381019461919' },
  { name: 'Filas Puentes Bville/Matamoros — SOLO FILA PUENTES',                  region: 'brownsville', url: 'https://www.facebook.com/groups/2232818820081853' },
  { name: 'Filas de Puentes Matamoros - Brownsville',                             region: 'brownsville', url: 'https://www.facebook.com/groups/autosenmatamoros' },
  { name: 'Report on queues at international bridges in Nuevo Laredo',            region: 'laredo', url: 'https://www.facebook.com/groups/276336942705237' },
  { name: 'Fila puente 2. nuevo laredo tamaulipas NO CENTRI',                     region: 'laredo', url: 'https://www.facebook.com/groups/1752011028879761' },
  { name: 'Filas de los puentes 1 y 2 (Piedras Negras - Eagle Pass)',             region: 'eagle_pass', url: 'https://www.facebook.com/groups/994149160726349' },
  { name: 'Puente Internacional Piedras Negras - Eagle Pass',                     region: 'eagle_pass', url: 'https://www.facebook.com/groups/218202582825387' },
  { name: 'Reporte de Puentes Juarez-El Paso',                                    region: 'el_paso', url: 'https://www.facebook.com/groups/1615115372079924' },
  { name: 'TU REPORTE PUENTES JUAREZ/EL PASO',                                    region: 'el_paso', url: 'https://www.facebook.com/groups/reportepuentes' },
  { name: 'JRZ-ELP Bridge Report',                                                region: 'el_paso', url: 'https://www.facebook.com/groups/464122564438748' },
  { name: 'En Donde Va La Fila? San Luis RC',                                     region: 'san_luis', url: 'https://www.facebook.com/groups/208758912816787' },
]

export function groupsByRegion(region: FbGroupRegion): FacebookGroup[] {
  return FACEBOOK_GROUPS.filter(g => g.region === region)
}
