export interface CbpPort {
  port_number: string
  border: string
  port_name: string
  crossing_name: string
  hours: string
  passenger_vehicle_lanes: LaneData
  pedestrian_lanes: LaneData
  bicycle_lanes: LaneData
  commercial_vehicle_lanes: LaneData
  date_time?: string
  date?: string
  time?: string
}

export interface LaneData {
  maximum_lanes: string
  standard_lanes: WaitData
  nexus_sentri_lanes?: WaitData
  ready_lanes?: WaitData
  fast_lanes?: WaitData
}

export interface WaitData {
  is_open: string
  delay_minutes: string
  lanes_open: string
}

export interface PortWaitTime {
  portId: string
  portName: string
  crossingName: string
  city: string
  vehicle: number | null
  sentri: number | null
  pedestrian: number | null
  commercial: number | null
  vehicleLanesOpen: number | null
  sentriLanesOpen: number | null
  pedestrianLanesOpen: number | null
  commercialLanesOpen: number | null
  isClosed: boolean
  noData: boolean
  vehicleClosed: boolean
  pedestrianClosed: boolean
  commercialClosed: boolean
  recordedAt: string | null
  // Provenance — added so the UI can show users where the headline number comes from
  source?: 'cbp' | 'community' | 'consensus' | 'traffic' | 'camera'
  cbpVehicle?: number | null
  communityVehicle?: number | null
  trafficVehicle?: number | null
  // Camera-vision estimate (Claude Haiku looking at the live feed).
  // `cameraConfidence` is the model's own confidence; the blend only
  // promotes a camera reading to authoritative when confidence is
  // 'high' or 'medium'.
  cameraVehicle?: number | null
  cameraConfidence?: 'high' | 'medium' | 'low' | null
  cameraAgeMin?: number | null
  reportCount?: number
  lastReportMinAgo?: number | null
  cbpStaleMin?: number | null
  // Runtime override for localName set via /admin Ports tab. Wins over the
  // static portMeta.localName when present.
  localNameOverride?: string | null
  // Historical average vehicle wait at this hour-of-day, computed from the
  // last 30 days of wait_time_readings. Used as a fallback when CBP is
  // null / Update Pending so the card can show "~X min · usual at this
  // hour" instead of "no data — be the first." Part of the sensor-network
  // retention play — the more we capture, the smarter the fallback.
  historicalVehicle?: number | null

  // Pedestrian-specific sensor stack (v55). Headline `pedestrian` field
  // above is CBP-only; these are the richer signals.
  communityPedestrian?: number | null
  cameraPedestrian?: number | null
  cameraPedestrianCount?: number | null
  cameraPedestrianConfidence?: 'high' | 'medium' | 'low' | null
  // Average pedestrians per hour at this port from BTS monthly counts.
  // Hour-of-day distribution is intentionally flat — BTS is monthly
  // aggregate so we don't pretend to know intra-day shape we don't have.
  pedestrianBaselineHourly?: number | null
  // Where the pedestrian headline number came from. 'baseline' means we
  // had no live signal and surfaced the BTS-derived expectation as a
  // last-resort context value.
  pedestrianSource?: 'cbp' | 'community' | 'camera' | 'baseline' | 'flow_rate' | null
  // Derived wait estimate from queue depth ÷ booth throughput.
  // Computed when camera-vision delivered both pedestrians_estimated AND
  // pedestrian_lanes_visible. Independent of the pedestrian headline pick
  // — surfaced in the UI as a sanity-check alongside the headline number.
  pedestrianFlowRateMin?: number | null
  // Officer / booth staffing — derived from CBP's pedestrian lanes_open
  // field. Public BWT API publishes this every poll; we expose it
  // semantically as "officers currently open" since each pedestrian
  // booth corresponds 1:1 with a CBP officer doing inspections.
  pedestrianOfficersOpen?: number | null
  // Average pedestrian lanes_open at this port at this hour-of-day,
  // computed from the last 30 days of wait_time_readings. Lets the
  // card surface "fewer officers than usual" as a leading indicator
  // — wait time can still be low when CBP just understaffed a booth,
  // but it's about to spike.
  pedestrianOfficersTypical?: number | null
}

export interface WaitTimeReading {
  id: string
  port_id: string
  port_name: string
  crossing_name: string
  vehicle_wait: number | null
  sentri_wait: number | null
  pedestrian_wait: number | null
  commercial_wait: number | null
  recorded_at: string
  day_of_week: number
  hour_of_day: number
}

export type WaitLevel = 'low' | 'medium' | 'high' | 'closed' | 'unknown'
