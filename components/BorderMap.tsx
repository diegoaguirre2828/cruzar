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
          radius: 12,
          fillColor: color,
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9,
        })

        marker.bindPopup(`
          <div style="font-family:sans-serif;min-width:140px">
            <strong style="font-size:13px">${port.portName}</strong><br/>
            <span style="font-size:11px;color:#666">${port.crossingName}</span><br/>
            <div style="margin-top:6px;font-size:12px">
              🚗 Car: <strong>${wait !== null ? wait + ' min' : 'N/A'}</strong><br/>
              🚶 Walk: <strong>${port.pedestrian !== null ? port.pedestrian + ' min' : 'N/A'}</strong><br/>
              ⚡ SENTRI: <strong>${port.sentri !== null ? port.sentri + ' min' : 'N/A'}</strong>
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
