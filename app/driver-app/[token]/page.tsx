'use client'

import { use, useEffect, useState } from 'react'
import { Truck, MapPin } from 'lucide-react'

interface Assignment {
  id: string
  load_id: string
  tracked_loads: { load_ref: string; recommended_port_id: string | null; dest_address: string; appointment_at: string; predicted_arrival_at: string | null } | null
}
interface Driver {
  id: string
  display_name: string
  truck_number: string | null
  status: string
  last_seen_at: string | null
}

const STATUSES = ['available', 'en_route', 'in_line', 'at_agent', 'crossed', 'delivered', 'off_duty'] as const

export default function DriverAppPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [driver, setDriver] = useState<Driver | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [busy, setBusy] = useState(false)

  async function load() {
    const j = await fetch(`/api/operator/checkin?token=${encodeURIComponent(token)}`).then((r) => r.json())
    if (j.driver) setDriver(j.driver)
    setAssignments(j.assignments ?? [])
  }
  useEffect(() => { load() }, [token])

  async function setStatus(status: string) {
    setBusy(true)
    let lat: number | undefined
    let lng: number | undefined
    await new Promise<void>((resolve) => {
      if (!navigator.geolocation) { resolve(); return }
      navigator.geolocation.getCurrentPosition(
        (p) => { lat = p.coords.latitude; lng = p.coords.longitude; resolve() },
        () => resolve(),
        { maximumAge: 30000, timeout: 5000 },
      )
    })
    await fetch('/api/operator/checkin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, status, lat, lng }),
    })
    await load()
    setBusy(false)
  }

  if (!driver) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <p className="text-sm text-gray-500">Loading…</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center"><Truck className="w-5 h-5 text-blue-600" /></div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{driver.display_name}</h1>
            {driver.truck_number && <p className="text-xs text-gray-500">Truck {driver.truck_number}</p>}
          </div>
        </div>

        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm mb-5">
          <h2 className="text-sm font-semibold mb-3">My status</h2>
          <div className="grid grid-cols-2 gap-2">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                disabled={busy}
                className={`py-2 rounded-lg text-xs font-semibold ${driver.status === s ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'} disabled:opacity-50`}
              >
                {s.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
          {driver.last_seen_at && <p className="text-xs text-gray-500 mt-3 flex items-center gap-1"><MapPin className="w-3 h-3" /> Last update {new Date(driver.last_seen_at).toLocaleTimeString()}</p>}
        </section>

        <section>
          <h2 className="text-sm font-semibold mb-3">My loads ({assignments.length})</h2>
          {assignments.length === 0 ? (
            <p className="text-sm text-gray-500">No active loads assigned.</p>
          ) : (
            <ul className="space-y-2">
              {assignments.map((a) => (
                <li key={a.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-3 text-sm">
                  <div className="font-mono text-xs">{a.tracked_loads?.load_ref}</div>
                  <div className="text-xs text-gray-500 mt-1">Bridge: {a.tracked_loads?.recommended_port_id ?? '—'}</div>
                  <div className="text-xs text-gray-500">Dock: {a.tracked_loads?.dest_address}</div>
                  <div className="text-xs text-gray-500">Appointment: {a.tracked_loads?.appointment_at && new Date(a.tracked_loads.appointment_at).toLocaleString()}</div>
                  {a.tracked_loads?.predicted_arrival_at && <div className="text-xs text-gray-500">Predicted arrival: {new Date(a.tracked_loads.predicted_arrival_at).toLocaleString()}</div>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
