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
  source?: 'cbp' | 'community' | 'consensus' | 'traffic'
  cbpVehicle?: number | null
  communityVehicle?: number | null
  trafficVehicle?: number | null
  reportCount?: number
  lastReportMinAgo?: number | null
  cbpStaleMin?: number | null
  // Runtime override for localName set via /admin Ports tab. Wins over the
  // static portMeta.localName when present.
  localNameOverride?: string | null
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
