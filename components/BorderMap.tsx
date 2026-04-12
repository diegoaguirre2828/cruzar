'use client'

import { useEffect, useRef } from 'react'
import type { PortWaitTime } from '@/types'
import { getPortMeta } from '@/lib/portMeta'
import { getWaitLevel } from '@/lib/cbp'

interface Props {
  ports: PortWaitTime[]
  selectedRegion: string
  onPortClick: (portId: string) => void
}

const LEVEL_COLORS = {
  low: '#22c55e',
  medium: '#eab308',
  high: '#ef4444',
  closed: '#9ca3af',
  unknown: '#9ca3af',
}

export function BorderMap({ ports, selectedRegion, onPortClick }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<unknown>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    async function initMap() {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')

      const map = L.map(mapRef.current!, {
        center: [26.5, -98.8],
        zoom: 7,
        zoomControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map)

      mapInstanceRef.current = map
    }

    initMap()

    return () => {
      if (mapInstanceRef.current) {
        ;(mapInstanceRef.current as { remove: () => void }).remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!mapInstanceRef.current) return

    async function updateMarkers() {
      const L = (await import('leaflet')).default
      const map = mapInstanceRef.current as ReturnType<typeof L.map>

      // Remove existing markers
      map.eachLayer((layer) => {
        if (layer instanceof L.CircleMarker) map.removeLayer(layer)
      })

      const filtered = selectedRegion === 'All'
        ? ports
        : ports.filter(p => getPortMeta(p.portId).region === selectedRegion)

      filtered.forEach((port) => {
        const meta = getPortMeta(port.portId)
        const level = getWaitLevel(port.vehicle ?? port.pedestrian)
        const color = LEVEL_COLORS[level]
        const wait = port.vehicle ?? port.pedestrian

        const marker = L.circleMarker([meta.lat, meta.lng], {
          radius: 22,
          fillColor: color,
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9,
        })

        const fmt = (v: number | null) => v !== null ? `${v} min` : '—'
        marker.bindPopup(`
          <div style="font-family:sans-serif;min-width:160px;padding:2px 0">
            <strong style="font-size:13px">${port.portName}</strong><br/>
            <span style="font-size:11px;color:#888">${port.crossingName}</span>
            <div style="margin-top:8px;font-size:12px;display:grid;grid-template-columns:1fr 1fr;gap:4px">
              <div style="background:#f8f8f8;border-radius:8px;padding:6px;text-align:center">
                <div style="font-size:10px;color:#888">🚗 Auto/Car</div>
                <div style="font-weight:700">${fmt(port.vehicle)}</div>
              </div>
              <div style="background:#f8f8f8;border-radius:8px;padding:6px;text-align:center">
                <div style="font-size:10px;color:#888">🚛 Camión/Truck</div>
                <div style="font-weight:700">${fmt(port.commercial)}</div>
              </div>
              <div style="background:#f8f8f8;border-radius:8px;padding:6px;text-align:center">
                <div style="font-size:10px;color:#888">🚶 Peatón/Walk</div>
                <div style="font-weight:700">${fmt(port.pedestrian)}</div>
              </div>
              <div style="background:#f8f8f8;border-radius:8px;padding:6px;text-align:center">
                <div style="font-size:10px;color:#888">⚡ SENTRI</div>
                <div style="font-weight:700">${fmt(port.sentri)}</div>
              </div>
            </div>
            <div style="margin-top:8px;text-align:center">
              <span style="font-size:11px;color:#3b82f6;cursor:pointer">Ver detalles / Details →</span>
            </div>
          </div>
        `)

        marker.on('click', () => onPortClick(port.portId))
        marker.addTo(map)
      })

      // Fit map to filtered ports
      if (filtered.length > 0 && selectedRegion !== 'All') {
        const coords = filtered.map(p => {
          const m = getPortMeta(p.portId)
          return [m.lat, m.lng] as [number, number]
        })
        map.fitBounds(coords, { padding: [40, 40] })
      }
    }

    updateMarkers()
  }, [ports, selectedRegion, onPortClick])

  return (
    <div
      ref={mapRef}
      className="w-full rounded-2xl overflow-hidden border border-gray-200 shadow-sm"
      style={{ height: '280px' }}
    />
  )
}
