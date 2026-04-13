'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from './useAuth'
import { createClient } from './auth'
import { PORT_META, type MegaRegion } from './portMeta'
import { haversineKm } from './geo'

// Home region scoping — the default megaRegion a user's home page list
// and map pins filter to. Reduces troll surface area (a Mexicali user
// can't casually fake-report Matamoros) and cuts noise for users who
// only cross one part of the border.
//
// Resolution order on mount:
//   1. Signed-in user's profile.home_region (server truth)
//   2. localStorage 'cruzar_home_region' (guest or before profile sync)
//   3. Geolocation → nearest port's megaRegion
//   4. null (user sees all; they'll pick manually)
//
// Business tier is exempt — fleets often cross multiple regions, so
// the filter is a net negative for them. Components that consume this
// should bypass scoping when tier === 'business'.

const LS_KEY = 'cruzar_home_region'

export const MEGA_REGIONS: MegaRegion[] = [
  'rgv', 'laredo', 'coahuila-tx', 'el-paso', 'sonora-az', 'baja', 'other',
]

export const MEGA_REGION_LABELS: Record<MegaRegion, { es: string; en: string; short: string }> = {
  rgv:           { es: 'Valle de Texas',           en: 'Rio Grande Valley',  short: 'RGV' },
  laredo:        { es: 'Laredo / Nuevo Laredo',    en: 'Laredo',             short: 'Laredo' },
  'coahuila-tx': { es: 'Piedras Negras / Acuña',   en: 'Coahuila — Texas',   short: 'Coahuila' },
  'el-paso':     { es: 'Cd. Juárez / El Paso',     en: 'El Paso',            short: 'El Paso' },
  'sonora-az':   { es: 'Sonora / Arizona',         en: 'Sonora / Arizona',   short: 'Sonora' },
  baja:          { es: 'Baja California',          en: 'Baja California',    short: 'Baja' },
  other:         { es: 'Otros',                    en: 'Other',              short: 'Otros' },
}

// Find the nearest port's megaRegion given a user's coordinates.
// Returns null if no port is within 200 km (almost certainly means
// the user isn't actually near the border — don't guess for them).
function detectRegionFromCoords(lat: number, lng: number): MegaRegion | null {
  let best: { region: MegaRegion; dist: number } | null = null
  for (const meta of Object.values(PORT_META)) {
    if (!meta.lat || !meta.lng) continue
    const d = haversineKm(lat, lng, meta.lat, meta.lng)
    if (!best || d < best.dist) best = { region: meta.megaRegion, dist: d }
  }
  if (!best || best.dist > 200) return null
  return best.region
}

export function useHomeRegion() {
  const { user, loading: authLoading } = useAuth()
  const [homeRegion, setHomeRegionState] = useState<MegaRegion | null>(null)
  const [loading, setLoading] = useState(true)

  // Load initial value — profile first, localStorage second.
  useEffect(() => {
    if (authLoading) return

    let cancelled = false

    ;(async () => {
      // Signed-in: read from profile first
      if (user) {
        try {
          const supabase = createClient()
          const { data } = await supabase
            .from('profiles')
            .select('home_region')
            .eq('id', user.id)
            .single()
          if (cancelled) return
          if (data?.home_region && MEGA_REGIONS.includes(data.home_region as MegaRegion)) {
            setHomeRegionState(data.home_region as MegaRegion)
            try { localStorage.setItem(LS_KEY, data.home_region) } catch {}
            setLoading(false)
            return
          }
        } catch { /* fall through to localStorage */ }
      }

      // Guest or no profile value — try localStorage
      try {
        const stored = localStorage.getItem(LS_KEY) as MegaRegion | null
        if (stored && MEGA_REGIONS.includes(stored)) {
          if (!cancelled) {
            setHomeRegionState(stored)
            setLoading(false)
          }
          return
        }
      } catch { /* ignore */ }

      // Nothing stored — detect via geo (non-blocking, one shot)
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        const timer = setTimeout(() => { if (!cancelled) setLoading(false) }, 4500)
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            clearTimeout(timer)
            if (cancelled) return
            const detected = detectRegionFromCoords(pos.coords.latitude, pos.coords.longitude)
            if (detected) {
              setHomeRegionState(detected)
              try { localStorage.setItem(LS_KEY, detected) } catch {}
              // Sync to profile if signed in
              if (user) {
                fetch('/api/profile/region', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ homeRegion: detected }),
                }).catch(() => {})
              }
            }
            setLoading(false)
          },
          () => {
            clearTimeout(timer)
            if (!cancelled) setLoading(false)
          },
          { maximumAge: 5 * 60 * 1000, timeout: 4000, enableHighAccuracy: false },
        )
      } else if (!cancelled) {
        setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [user, authLoading])

  const setHomeRegion = useCallback((region: MegaRegion | null) => {
    setHomeRegionState(region)
    try {
      if (region) localStorage.setItem(LS_KEY, region)
      else localStorage.removeItem(LS_KEY)
    } catch {}
    if (user && region) {
      fetch('/api/profile/region', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeRegion: region }),
      }).catch(() => {})
    }
  }, [user])

  return { homeRegion, setHomeRegion, loading }
}
