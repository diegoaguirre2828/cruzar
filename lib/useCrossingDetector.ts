'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PORT_META } from '@/lib/portMeta'
import { INLAND_CHECKPOINTS } from '@/lib/inlandCheckpoints'

// Auto-crossing detection (Phase 1 of the Cruzar Insights flywheel).
//
// What this hook does:
//   1. After the user taps "I'm in line now" in WaitingMode, starts a
//      continuous geolocation watch + records the entry side of the
//      international border (US north of the bridge lat, MX south).
//   2. When the watched position crosses to the opposite side AND
//      moves >= ABORT_FAR_KM from the bridge, declares a crossing,
//      computes dt_minutes from the in-line ts, and surfaces a
//      confirm-toast back to the UI.
//   3. After a confirmed crossing, keeps watching for up to
//      INLAND_TRACK_MS so we can detect dwell time at known inland
//      checkpoints (Falfurrias, Sarita, Hebbronville on US side;
//      Garita 21KM Reynosa/Matamoros on MX side). Anonymized writes.
//
// Privacy: GPS positions live in component-scoped refs and never
// leave the device. Only {port_id, side_in, side_out, dt_minutes}
// (bridge) or {checkpoint_zone, direction, dt_minutes} (inland) get
// POSTed, with no user_id payload.
//
// Battery: max 4h watch lifetime per crossing session. Auto-stops on
// successful inland recording or timeout.

const NEARBY_KM = 3
const ABORT_FAR_KM = 4         // user must move >ABORT_FAR_KM from bridge to count as a real crossing
const SIDE_BUFFER_DEG = 0.0008 // ~90m buffer around bridge lat to call a side flip
const INLAND_RADIUS_KM = 1.5   // dwell zone around each known checkpoint
const INLAND_EXIT_KM = 3       // user has cleared the checkpoint when this far away
const INLAND_MIN_DWELL_MS = 8 * 60 * 1000   // ignore <8min dwells (drive-bys, not stops)
const INLAND_MAX_DWELL_MS = 6 * 60 * 60 * 1000 // safety cap
const INLAND_TRACK_MS = 4 * 60 * 60 * 1000     // shut down inland watch after 4h
const SESSION_KEY = 'cruzar_crossing_session'

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function sideOfBorder(userLat: number, portLat: number): 'US' | 'MX' | 'on_bridge' {
  if (userLat > portLat + SIDE_BUFFER_DEG) return 'US'
  if (userLat < portLat - SIDE_BUFFER_DEG) return 'MX'
  return 'on_bridge'
}

interface InLineSession {
  portId: string
  portName: string
  enteredAt: number
  enteredSide: 'US' | 'MX'
  bridgeLat: number
  bridgeLng: number
}

interface CrossedResult {
  portId: string
  portName: string
  sideIn: 'US' | 'MX'
  sideOut: 'US' | 'MX'
  dtMinutes: number
}

interface InlandTrackerState {
  zone: string
  direction: 'northbound' | 'southbound'
  zoneLat: number
  zoneLng: number
  enteredAt: number
}

export function useCrossingDetector(optedIn: boolean) {
  const [inLine, setInLine] = useState<InLineSession | null>(null)
  const [crossed, setCrossed] = useState<CrossedResult | null>(null)
  const [tickMs, setTickMs] = useState(0) // re-render every minute while in-line so the timer ticks
  const watchIdRef = useRef<number | null>(null)
  const inlandRef = useRef<InlandTrackerState | null>(null)
  const inlandStartRef = useRef<number>(0)
  const inlandTrackingRef = useRef(false)

  // Keep a stable copy of the in-line session in a ref so the watch
  // callback (created once per watch) reads the current value.
  const sessionRef = useRef<InLineSession | null>(null)
  useEffect(() => { sessionRef.current = inLine }, [inLine])

  // Restore an in-progress session on mount (page reloads, brief
  // backgrounding) — only if the user is still opted in.
  useEffect(() => {
    if (!optedIn || typeof window === 'undefined') return
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as InLineSession
      // Sanity: discard sessions older than 6h to avoid resurrecting
      // stale state after a long backgrounded period.
      if (Date.now() - parsed.enteredAt > 6 * 60 * 60 * 1000) {
        sessionStorage.removeItem(SESSION_KEY)
        return
      }
      setInLine(parsed)
    } catch {
      sessionStorage.removeItem(SESSION_KEY)
    }
  }, [optedIn])

  // Tick every 60s so the on-screen timer updates without each watch
  // event needing to re-render upstream consumers.
  useEffect(() => {
    if (!inLine) return
    const id = setInterval(() => setTickMs(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [inLine])

  const stopWatch = useCallback(() => {
    if (watchIdRef.current != null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current)
    }
    watchIdRef.current = null
    inlandRef.current = null
    inlandTrackingRef.current = false
  }, [])

  const recordInlandDwell = useCallback(
    async (state: InlandTrackerState, exitedAt: number) => {
      const dtMs = exitedAt - state.enteredAt
      if (dtMs < INLAND_MIN_DWELL_MS) return
      if (dtMs > INLAND_MAX_DWELL_MS) return
      const dtMinutes = Math.round(dtMs / 60_000)
      try {
        await fetch('/api/auto-crossings/inland', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            checkpoint_zone: state.zone,
            direction: state.direction,
            dt_minutes: dtMinutes,
          }),
        })
      } catch {
        // Best-effort write — drop silently rather than retrying and
        // burning battery on a flaky connection.
      }
    },
    [],
  )

  const handleInlandTick = useCallback(
    (lat: number, lng: number) => {
      if (Date.now() - inlandStartRef.current > INLAND_TRACK_MS) {
        // 4h cap reached — force-stop. If we were mid-dwell, flush it.
        if (inlandRef.current) {
          recordInlandDwell(inlandRef.current, Date.now())
        }
        stopWatch()
        return
      }
      const active = inlandRef.current
      if (active) {
        const dist = distanceKm(lat, lng, active.zoneLat, active.zoneLng)
        if (dist > INLAND_EXIT_KM) {
          recordInlandDwell(active, Date.now())
          inlandRef.current = null
        }
        return
      }
      // Not currently inside any checkpoint zone — see if we just entered one.
      for (const cp of INLAND_CHECKPOINTS) {
        const dist = distanceKm(lat, lng, cp.lat, cp.lng)
        if (dist <= INLAND_RADIUS_KM) {
          inlandRef.current = {
            zone: cp.zone,
            direction: cp.direction,
            zoneLat: cp.lat,
            zoneLng: cp.lng,
            enteredAt: Date.now(),
          }
          return
        }
      }
    },
    [recordInlandDwell, stopWatch],
  )

  // Position-event handler. Routes by current phase:
  //   - in-line: detect side flip + far-from-bridge → set crossed
  //   - inland tracking: detect dwell at known checkpoints
  const onPosition = useCallback(
    (pos: GeolocationPosition) => {
      const { latitude, longitude } = pos.coords
      const session = sessionRef.current

      if (session) {
        const currentSide = sideOfBorder(latitude, session.bridgeLat)
        const dist = distanceKm(latitude, longitude, session.bridgeLat, session.bridgeLng)

        // Aborted: user wandered out of the geofence on the SAME side
        // they entered. Void the observation cleanly.
        if (currentSide === session.enteredSide && dist > ABORT_FAR_KM) {
          sessionRef.current = null
          setInLine(null)
          if (typeof window !== 'undefined') sessionStorage.removeItem(SESSION_KEY)
          stopWatch()
          return
        }

        // Crossed: side flipped AND user moved well past the bridge.
        if (
          currentSide !== 'on_bridge' &&
          currentSide !== session.enteredSide &&
          dist > ABORT_FAR_KM
        ) {
          const dtMinutes = Math.max(1, Math.round((Date.now() - session.enteredAt) / 60_000))
          const result: CrossedResult = {
            portId: session.portId,
            portName: session.portName,
            sideIn: session.enteredSide,
            sideOut: currentSide,
            dtMinutes,
          }
          setCrossed(result)
          sessionRef.current = null
          setInLine(null)
          if (typeof window !== 'undefined') sessionStorage.removeItem(SESSION_KEY)
          // Hand off to inland tracking — keep the same watch alive.
          inlandTrackingRef.current = true
          inlandStartRef.current = Date.now()
          inlandRef.current = null
          return
        }
        return
      }

      if (inlandTrackingRef.current) {
        handleInlandTick(latitude, longitude)
      }
    },
    [handleInlandTick, stopWatch],
  )

  // Start the watch whenever either phase is active. iOS app users
  // get the @capacitor/geolocation native watch via the same
  // navigator.geolocation polyfill (Capacitor wires it).
  useEffect(() => {
    const needsWatch = !!inLine || inlandTrackingRef.current
    if (!needsWatch || typeof navigator === 'undefined' || !navigator.geolocation) return
    if (watchIdRef.current != null) return
    watchIdRef.current = navigator.geolocation.watchPosition(
      onPosition,
      () => {},
      { enableHighAccuracy: true, maximumAge: 30_000 },
    )
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [inLine, onPosition])

  const startInLine = useCallback(
    (portId: string, portName: string, currentLat: number, currentLng: number) => {
      const meta = PORT_META[portId]
      if (!meta) return
      const enteredSide = sideOfBorder(currentLat, meta.lat)
      // If the user is already on the bridge itself, treat them as on
      // the side closest to their actual lat (rare, since they had to
      // be inside 3km but not directly on top of the bridge).
      const resolvedSide: 'US' | 'MX' = enteredSide === 'on_bridge'
        ? (currentLat >= meta.lat ? 'US' : 'MX')
        : enteredSide
      const session: InLineSession = {
        portId,
        portName,
        enteredAt: Date.now(),
        enteredSide: resolvedSide,
        bridgeLat: meta.lat,
        bridgeLng: meta.lng,
      }
      setInLine(session)
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
      }
    },
    [],
  )

  const cancelInLine = useCallback(() => {
    sessionRef.current = null
    setInLine(null)
    if (typeof window !== 'undefined') sessionStorage.removeItem(SESSION_KEY)
    stopWatch()
  }, [stopWatch])

  const dismissCrossed = useCallback(() => {
    setCrossed(null)
  }, [])

  return {
    inLine,
    elapsedMin: inLine ? Math.max(0, Math.round((Date.now() - inLine.enteredAt) / 60_000)) : 0,
    crossed,
    startInLine,
    cancelInLine,
    dismissCrossed,
    _tickMs: tickMs, // unused externally; surfacing for future debug
  }
}
