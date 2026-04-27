'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Truck, Plus, Trash2, ExternalLink } from 'lucide-react'

interface Driver {
  id: string
  display_name: string
  phone: string | null
  truck_number: string | null
  active: boolean
  status: string
  checkin_token: string
  last_seen_at: string | null
}

interface Load {
  id: string
  load_ref: string
  recommended_port_id: string | null
  predicted_arrival_at: string | null
  appointment_at: string
  status: string
  detention_risk_dollars: number | null
  p_make_appointment: number | null
}

interface Assignment {
  id: string
  driver_id: string
  load_id: string
  operator_drivers: { display_name: string; status: string; truck_number: string | null } | null
  tracked_loads: { load_ref: string; recommended_port_id: string | null; predicted_arrival_at: string | null; p_make_appointment: number | null; detention_risk_dollars: number | null } | null
}

const STATUS_LABELS: Record<string, string> = {
  available: 'Available',
  en_route: 'En route',
  in_line: 'In line',
  at_agent: 'At agent',
  crossed: 'Crossed',
  delivered: 'Delivered',
  off_duty: 'Off duty',
}

export default function OperatorDispatchPage() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loads, setLoads] = useState<Load[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [name, setName] = useState('')
  const [truck, setTruck] = useState('')
  const [phone, setPhone] = useState('')
  const [pickDriver, setPickDriver] = useState('')
  const [pickLoad, setPickLoad] = useState('')

  async function loadAll() {
    const [d, l, a] = await Promise.all([
      fetch('/api/operator/drivers').then((r) => r.json()).catch(() => ({ drivers: [] })),
      fetch('/api/insights/loads').then((r) => r.json()).catch(() => ({ loads: [] })),
      fetch('/api/operator/assignments').then((r) => r.json()).catch(() => ({ assignments: [] })),
    ])
    setDrivers(d.drivers ?? [])
    setLoads(l.loads ?? [])
    setAssignments(a.assignments ?? [])
  }
  useEffect(() => { loadAll() }, [])

  async function addDriver() {
    if (!name) return
    await fetch('/api/operator/drivers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ display_name: name, truck_number: truck || undefined, phone: phone || undefined }),
    })
    setName(''); setTruck(''); setPhone('')
    loadAll()
  }
  async function delDriver(id: string) {
    if (!confirm('Delete driver?')) return
    await fetch(`/api/operator/drivers/${id}`, { method: 'DELETE' })
    loadAll()
  }

  async function assign() {
    if (!pickDriver || !pickLoad) return
    await fetch('/api/operator/assignments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ driver_id: pickDriver, load_id: pickLoad }),
    })
    setPickDriver(''); setPickLoad('')
    loadAll()
  }
  async function unassign(id: string) {
    await fetch(`/api/operator/assignments?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    loadAll()
  }

  return (
    <main className="min-h-screen bg-stone-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Operator dispatch</h1>
            <p className="text-sm text-zinc-500 mt-1">Drivers, loads, assignments — all on one screen.</p>
          </div>
          <Link href="/insights/loads" className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> Loads</Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Plus className="w-4 h-4" /> Add driver</h2>
            <div className="space-y-2">
              <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="w-full text-sm rounded-lg bg-stone-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2" />
              <input placeholder="Truck #" value={truck} onChange={(e) => setTruck(e.target.value)} className="w-full text-sm rounded-lg bg-stone-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2" />
              <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full text-sm rounded-lg bg-stone-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2" />
              <button onClick={addDriver} disabled={!name} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 rounded-lg disabled:opacity-50">Add</button>
            </div>
          </section>

          <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Truck className="w-4 h-4" /> Assign driver to load</h2>
            <div className="space-y-2">
              <select value={pickDriver} onChange={(e) => setPickDriver(e.target.value)} className="w-full text-sm rounded-lg bg-stone-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2">
                <option value="">Pick driver…</option>
                {drivers.filter((d) => d.active).map((d) => <option key={d.id} value={d.id}>{d.display_name}{d.truck_number ? ` · ${d.truck_number}` : ''}</option>)}
              </select>
              <select value={pickLoad} onChange={(e) => setPickLoad(e.target.value)} className="w-full text-sm rounded-lg bg-stone-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2">
                <option value="">Pick load…</option>
                {loads.filter((l) => l.status === 'tracking' || l.status === 'crossed').map((l) => <option key={l.id} value={l.id}>{l.load_ref} → {l.recommended_port_id ?? '?'}</option>)}
              </select>
              <button onClick={assign} disabled={!pickDriver || !pickLoad} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 rounded-lg disabled:opacity-50">Assign</button>
            </div>
          </section>
        </div>

        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm mb-6">
          <h2 className="text-sm font-semibold mb-3">Active assignments ({assignments.length})</h2>
          {assignments.length === 0 ? (
            <p className="text-sm text-zinc-500">No active assignments.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="py-2">Driver</th>
                    <th className="py-2">Load</th>
                    <th className="py-2">Bridge</th>
                    <th className="py-2">P(make)</th>
                    <th className="py-2">$ exposure</th>
                    <th className="py-2">Driver status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr key={a.id} className="border-b border-zinc-100 dark:border-zinc-900">
                      <td className="py-2">{a.operator_drivers?.display_name ?? '—'} {a.operator_drivers?.truck_number && <span className="text-xs text-zinc-500">·{a.operator_drivers.truck_number}</span>}</td>
                      <td className="py-2 font-mono text-xs">{a.tracked_loads?.load_ref ?? '—'}</td>
                      <td className="py-2">{a.tracked_loads?.recommended_port_id ?? '—'}</td>
                      <td className="py-2">{a.tracked_loads?.p_make_appointment != null ? a.tracked_loads.p_make_appointment.toFixed(2) : '—'}</td>
                      <td className="py-2">{a.tracked_loads?.detention_risk_dollars != null ? `$${a.tracked_loads.detention_risk_dollars.toFixed(0)}` : '—'}</td>
                      <td className="py-2">{STATUS_LABELS[a.operator_drivers?.status ?? 'available']}</td>
                      <td className="py-2 text-right">
                        <button onClick={() => unassign(a.id)} className="text-xs text-red-500 hover:underline">Unassign</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold mb-3">Drivers ({drivers.length})</h2>
          {drivers.length === 0 ? (
            <p className="text-sm text-zinc-500">No drivers yet.</p>
          ) : (
            <ul className="space-y-2">
              {drivers.map((d) => (
                <li key={d.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{d.display_name}</span>
                    {d.truck_number && <span className="text-xs text-zinc-500 ml-2">·{d.truck_number}</span>}
                    <span className="text-xs ml-2 px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">{STATUS_LABELS[d.status]}</span>
                    {d.last_seen_at && <span className="text-xs text-zinc-500 ml-2">last {new Date(d.last_seen_at).toLocaleTimeString()}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/driver-app/${d.checkin_token}`} target="_blank" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> Driver link
                    </Link>
                    <button onClick={() => delDriver(d.id)} className="text-zinc-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
