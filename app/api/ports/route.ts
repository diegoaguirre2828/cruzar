import { NextResponse } from 'next/server'
import { fetchRgvWaitTimes } from '@/lib/cbp'
import { getServiceClient } from '@/lib/supabase'
import { fetchTrafficWaits } from '@/lib/traffic'
import type { PortWaitTime } from '@/types'

export const dynamic = 'force-dynamic'

const REPORT_FRESH_MIN = 30
const CBP_STALE_MIN = 25
const DIVERGE_THRESHOLD_MIN = 15

interface RecentReport {
  port_id: string
  wait_minutes: number | null
  report_type: string
  created_at: string
}

function parseCbpRecorded(s: string | null): Date | null {
  if (!s) return null
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d
  return null
}

function weightedAvg(items: { val: number; weight: number }[]): number {
  const totalW = items.reduce((s, i) => s + i.weight, 0)
  if (totalW === 0) return 0
  const sum = items.reduce((s, i) => s + i.val * i.weight, 0)
  return Math.round(sum / totalW)
}

export async function GET() {
  try {
    const ports = await fetchRgvWaitTimes()
    const cbpUpdatedAt = ports[0]?.recordedAt ?? null

    const db = getServiceClient()
    const sinceIso = new Date(Date.now() - REPORT_FRESH_MIN * 60 * 1000).toISOString()
    const portIds = ports.map((p) => p.portId)

    const [reportsRes, trafficWaits] = await Promise.all([
      db
        .from('crossing_reports')
        .select('port_id, wait_minutes, report_type, created_at')
        .in('port_id', portIds)
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false }),
      fetchTrafficWaits(portIds).catch(() => new Map<string, number>()),
    ])

    const reportsByPort = new Map<string, RecentReport[]>()
    if (!reportsRes.error && reportsRes.data) {
      for (const r of reportsRes.data as RecentReport[]) {
        const arr = reportsByPort.get(r.port_id) ?? []
        arr.push(r)
        reportsByPort.set(r.port_id, arr)
      }
    }

    const now = Date.now()

    const blended: PortWaitTime[] = ports.map((p) => {
      const reports = reportsByPort.get(p.portId) ?? []
      const reportsWithWait = reports.filter((r) => r.wait_minutes != null && r.wait_minutes >= 0)
      const reportCount = reportsWithWait.length
      const communityVehicle =
        reportCount > 0
          ? Math.round(reportsWithWait.reduce((s, r) => s + (r.wait_minutes as number), 0) / reportCount)
          : null
      const lastReportMinAgo =
        reports.length > 0
          ? Math.round((now - new Date(reports[0].created_at).getTime()) / 60000)
          : null

      const trafficVehicle = trafficWaits.get(p.portId) ?? null

      const cbpDate = parseCbpRecorded(p.recordedAt)
      const cbpStaleMin = cbpDate ? Math.round((now - cbpDate.getTime()) / 60000) : null
      const cbpIsStale = cbpStaleMin != null && cbpStaleMin > CBP_STALE_MIN

      const cbpVehicle = p.vehicle

      let chosen: number | null = cbpVehicle
      let source: PortWaitTime['source'] = 'cbp'

      const candidates: { val: number; src: NonNullable<PortWaitTime['source']>; weight: number }[] = []
      if (cbpVehicle != null && !cbpIsStale) candidates.push({ val: cbpVehicle, src: 'cbp', weight: 1 })
      if (trafficVehicle != null) candidates.push({ val: trafficVehicle, src: 'traffic', weight: 2 })
      if (communityVehicle != null && reportCount >= 1) {
        candidates.push({ val: communityVehicle, src: 'community', weight: Math.min(reportCount + 1, 4) })
      }

      if (candidates.length > 0) {
        const nonCbp = candidates.filter((c) => c.src !== 'cbp')
        const cbpCand = candidates.find((c) => c.src === 'cbp')
        const diverges =
          cbpCand != null &&
          nonCbp.length > 0 &&
          Math.abs(nonCbp[0].val - cbpCand.val) >= DIVERGE_THRESHOLD_MIN

        if (diverges) {
          const filtered = candidates.filter((c) => c.src !== 'cbp')
          chosen = weightedAvg(filtered)
          source = filtered.length > 1 ? 'consensus' : filtered[0].src
        } else if (candidates.length === 1) {
          chosen = candidates[0].val
          source = candidates[0].src
        } else {
          chosen = weightedAvg(candidates)
          source = 'consensus'
        }
      } else if (cbpVehicle != null && cbpIsStale) {
        chosen = cbpVehicle
        source = 'cbp'
      }

      const accidentCount = reports.filter(
        (r) => r.report_type === 'accident' || r.report_type === 'inspection',
      ).length
      if (accidentCount >= 2 && chosen != null && chosen < 30) {
        chosen = Math.max(chosen, 30)
      }

      return {
        ...p,
        vehicle: chosen,
        source,
        cbpVehicle,
        communityVehicle,
        trafficVehicle,
        reportCount,
        lastReportMinAgo,
        cbpStaleMin,
      }
    })

    return NextResponse.json({
      ports: blended,
      fetchedAt: new Date().toISOString(),
      cbpUpdatedAt,
    })
  } catch (err) {
    console.error('Ports route error:', err)
    return NextResponse.json({ error: 'Failed to fetch wait times' }, { status: 502 })
  }
}
