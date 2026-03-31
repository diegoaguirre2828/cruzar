'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/useAuth'
import { getWaitLevel, waitLevelDot, waitLevelColor } from '@/lib/cbp'
import { getPortMeta } from '@/lib/portMeta'
import {
  ArrowLeft, RefreshCw, Package, Truck, Clock, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, Plus, X, Pencil, DollarSign, Users, Map,
  ChevronDown, ChevronUp, Filter, Download
} from 'lucide-react'
import type { PortWaitTime } from '@/types'

interface Shipment {
  id: string
  reference_id: string
  description: string | null
  origin: string | null
  destination: string | null
  port_id: string | null
  carrier: string | null
  driver_name: string | null
  driver_phone: string | null
  expected_crossing_at: string | null
  actual_crossing_at: string | null
  status: string
  delay_minutes: number
  notes: string | null
  created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  scheduled: { label: 'Scheduled', color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-900/20',   dot: 'bg-blue-400' },
  crossing:  { label: 'Crossing',  color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20', dot: 'bg-yellow-400 animate-pulse' },
  cleared:   { label: 'Cleared',   color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/20',  dot: 'bg-green-400' },
  delivered: { label: 'Delivered', color: 'text-gray-500',   bg: 'bg-gray-50 dark:bg-gray-800',       dot: 'bg-gray-300' },
  delayed:   { label: 'Delayed',   color: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-900/20',      dot: 'bg-red-500' },
}

const DELAY_COST_PER_HOUR = 85  // average cost/hr per commercial truck

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + formatTime(iso)
}

export default function BusinessPortalPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [ports, setPorts] = useState<PortWaitTime[]>([])
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [tier, setTier] = useState<string>('')
  const [cbpUpdatedAt, setCbpUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'dispatch' | 'shipments' | 'costs' | 'intel'>('dispatch')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAddShipment, setShowAddShipment] = useState(false)
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null)
  const [saving, setSaving] = useState(false)
  const [costDelay, setCostDelay] = useState(60)
  const [costTrucks, setCostTrucks] = useState(5)
  const [costRate, setCostRate] = useState(DELAY_COST_PER_HOUR)

  const blankForm = {
    reference_id: '', description: '', origin: '', destination: '',
    port_id: '', carrier: '', driver_name: '', driver_phone: '',
    expected_crossing_at: '', notes: ''
  }
  const [form, setForm] = useState(blankForm)

  const loadPorts = useCallback(async () => {
    const res = await fetch('/api/ports')
    if (res.ok) {
      const d = await res.json()
      setPorts(d.ports || [])
      setCbpUpdatedAt(d.cbpUpdatedAt ?? null)
    }
  }, [])

  const loadShipments = useCallback(async () => {
    const res = await fetch(`/api/business/shipments?status=${statusFilter}`)
    if (res.ok) {
      const d = await res.json()
      setShipments(d.shipments || [])
    }
  }, [statusFilter])

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
    if (user) {
      fetch('/api/profile').then(r => r.json()).then(d => {
        const t = d.profile?.tier || 'free'
        setTier(t)
        if (t !== 'business') router.push('/pricing')
      })
      Promise.all([loadPorts(), loadShipments()]).then(() => setLoading(false))
    }
  }, [user, authLoading, router, loadPorts, loadShipments])

  useEffect(() => { loadShipments() }, [statusFilter, loadShipments])

  async function saveShipment() {
    setSaving(true)
    const method = editingShipment ? 'PATCH' : 'POST'
    const body = editingShipment ? { id: editingShipment.id, ...form } : form
    await fetch('/api/business/shipments', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    setShowAddShipment(false)
    setEditingShipment(null)
    setForm(blankForm)
    loadShipments()
  }

  async function updateStatus(id: string, status: string) {
    await fetch('/api/business/shipments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    loadShipments()
  }

  async function deleteShipment(id: string) {
    await fetch(`/api/business/shipments?id=${id}`, { method: 'DELETE' })
    loadShipments()
  }

  function openEdit(s: Shipment) {
    setForm({
      reference_id: s.reference_id,
      description: s.description || '',
      origin: s.origin || '',
      destination: s.destination || '',
      port_id: s.port_id || '',
      carrier: s.carrier || '',
      driver_name: s.driver_name || '',
      driver_phone: s.driver_phone || '',
      expected_crossing_at: s.expected_crossing_at ? new Date(s.expected_crossing_at).toISOString().slice(0, 16) : '',
      notes: s.notes || '',
    })
    setEditingShipment(s)
    setShowAddShipment(true)
  }

  // Dispatcher metrics
  const activeShipments = shipments.filter(s => s.status === 'crossing').length
  const delayedShipments = shipments.filter(s => s.status === 'delayed').length
  const scheduledToday = shipments.filter(s => {
    if (!s.expected_crossing_at) return false
    const d = new Date(s.expected_crossing_at)
    const today = new Date()
    return d.toDateString() === today.toDateString()
  }).length

  // Best crossing ports
  const sortedByCommercial = [...ports]
    .filter(p => p.commercial !== null)
    .sort((a, b) => (a.commercial ?? 999) - (b.commercial ?? 999))
  const bestPorts = sortedByCommercial.slice(0, 5)

  // Cost calculator
  const totalCost = Math.round((costDelay / 60) * costTrucks * costRate)
  const annualImpact = Math.round(totalCost * 250)  // ~250 working days

  // Community reports for Intel tab
  const [portReports, setPortReports] = useState<Record<string, number>>({})
  useEffect(() => {
    if (activeTab !== 'intel') return
    Promise.all(
      bestPorts.slice(0, 3).map(p =>
        fetch(`/api/reports?portId=${encodeURIComponent(p.portId)}`)
          .then(r => r.json())
          .then(d => ({ portId: p.portId, count: d.reports?.length || 0 }))
      )
    ).then(results => {
      const map: Record<string, number> = {}
      results.forEach(r => { map[r.portId] = r.count })
      setPortReports(map)
    })
  }, [activeTab])

  const cbpTime = cbpUpdatedAt
    ? new Date(cbpUpdatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : null

  if (authLoading || loading || !tier) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 pb-16">
        {/* Header */}
        <div className="pt-6 pb-4 flex items-center justify-between">
          <div>
            <Link href="/fleet" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-1">
              <ArrowLeft className="w-3 h-3" /> Fleet Center
            </Link>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Business Portal</h1>
            {cbpTime && <p className="text-xs text-gray-400">Live data · CBP updated {cbpTime}</p>}
          </div>
          <button
            onClick={() => { loadPorts(); loadShipments() }}
            className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Quick stats bar */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-3 shadow-sm text-center">
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{activeShipments}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Crossing now</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-3 shadow-sm text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{scheduledToday}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Today's crossings</p>
          </div>
          <div className={`rounded-2xl border p-3 shadow-sm text-center ${delayedShipments > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
            <p className={`text-2xl font-bold ${delayedShipments > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>{delayedShipments}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Delayed</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-5 gap-1">
          {[
            { key: 'dispatch',  label: '🗺️ Dispatch' },
            { key: 'shipments', label: '📦 Shipments' },
            { key: 'costs',     label: '💰 Cost Calc' },
            { key: 'intel',     label: '📡 Intel' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as typeof activeTab)}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
                activeTab === t.key
                  ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── DISPATCH TAB ── */}
        {activeTab === 'dispatch' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Live Dispatcher Board</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">Ranked by commercial (truck) wait time. Click a crossing to view full details and community reports.</p>
            </div>

            {/* Best ports highlight */}
            {bestPorts.length > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <p className="text-sm font-semibold text-green-800 dark:text-green-300">Recommended crossings right now</p>
                </div>
                <div className="space-y-2">
                  {bestPorts.slice(0, 3).map((p, i) => (
                    <Link key={p.portId} href={`/port/${encodeURIComponent(p.portId)}`}>
                      <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-green-700 dark:text-green-400 w-5">#{i + 1}</span>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{p.portName}</p>
                            <p className="text-xs text-gray-400">{p.crossingName} · {getPortMeta(p.portId).region}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-green-700 dark:text-green-400">{p.commercial} min</p>
                          <p className="text-xs text-gray-400">truck</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* All ports table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">All Crossings</p>
                <p className="text-xs text-gray-400">{ports.length} ports</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[500px]">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700">
                      <th className="text-left text-xs text-gray-400 font-medium px-4 py-2">Crossing</th>
                      <th className="text-center text-xs text-gray-400 font-medium px-3 py-2">Car</th>
                      <th className="text-center text-xs text-gray-400 font-medium px-3 py-2">Truck</th>
                      <th className="text-center text-xs text-gray-400 font-medium px-3 py-2">SENTRI</th>
                      <th className="text-center text-xs text-gray-400 font-medium px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...ports]
                      .sort((a, b) => (a.commercial ?? 999) - (b.commercial ?? 999))
                      .map(port => {
                        const level = getWaitLevel(port.commercial ?? port.vehicle)
                        const dot = waitLevelDot(level)
                        const colors = waitLevelColor(level)
                        return (
                          <tr
                            key={port.portId}
                            onClick={() => router.push(`/port/${encodeURIComponent(port.portId)}`)}
                            className="border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                                <div>
                                  <p className="font-medium text-gray-900 dark:text-gray-100 text-xs leading-tight">{port.portName}</p>
                                  <p className="text-xs text-gray-400 leading-tight">{port.crossingName}</p>
                                </div>
                              </div>
                            </td>
                            <td className="text-center px-3 py-3 text-xs text-gray-600 dark:text-gray-400">
                              {port.vehicle !== null ? `${port.vehicle}m` : '—'}
                            </td>
                            <td className="text-center px-3 py-3">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${colors}`}>
                                {port.commercial !== null ? `${port.commercial}m` : '—'}
                              </span>
                            </td>
                            <td className="text-center px-3 py-3 text-xs text-gray-600 dark:text-gray-400">
                              {port.sentri !== null ? `${port.sentri}m` : '—'}
                            </td>
                            <td className="text-center px-3 py-3">
                              {level === 'low' && <span className="text-xs text-green-600 font-medium">Clear</span>}
                              {level === 'medium' && <span className="text-xs text-yellow-600 font-medium">Moderate</span>}
                              {level === 'high' && <span className="text-xs text-red-600 font-medium">Heavy</span>}
                              {level === 'closed' && <span className="text-xs text-gray-400">Closed</span>}
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── SHIPMENTS TAB ── */}
        {activeTab === 'shipments' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5 flex-wrap">
                {['all', 'scheduled', 'crossing', 'cleared', 'delayed', 'delivered'].map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`text-xs px-3 py-1.5 rounded-full border font-medium capitalize transition-colors ${
                      statusFilter === s
                        ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900'
                        : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <button
                onClick={() => { setForm(blankForm); setEditingShipment(null); setShowAddShipment(true) }}
                className="flex items-center gap-1 text-xs font-semibold bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-2 rounded-xl hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>

            {/* Add/edit form */}
            {showAddShipment && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {editingShipment ? 'Edit Shipment' : 'Add Shipment'}
                  </h3>
                  <button onClick={() => setShowAddShipment(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'reference_id', label: 'Reference / Load #', required: true, placeholder: 'e.g. LOAD-2024-001' },
                    { key: 'carrier',      label: 'Carrier',     placeholder: 'e.g. XYZ Freight' },
                    { key: 'origin',       label: 'Origin',      placeholder: 'e.g. Monterrey, MX' },
                    { key: 'destination',  label: 'Destination', placeholder: 'e.g. San Antonio, TX' },
                    { key: 'driver_name',  label: 'Driver name', placeholder: 'Driver full name' },
                    { key: 'driver_phone', label: 'Driver phone', placeholder: '+1 555-000-0000' },
                  ].map(field => (
                    <div key={field.key} className="col-span-1">
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">{field.label}</label>
                      <input
                        value={form[field.key as keyof typeof form]}
                        onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Expected crossing time</label>
                    <input
                      type="datetime-local"
                      value={form.expected_crossing_at}
                      onChange={e => setForm(f => ({ ...f, expected_crossing_at: e.target.value }))}
                      className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Crossing port</label>
                    <select
                      value={form.port_id}
                      onChange={e => setForm(f => ({ ...f, port_id: e.target.value }))}
                      className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Select crossing —</option>
                      {ports.map(p => (
                        <option key={p.portId} value={p.portId}>
                          {p.portName} – {p.crossingName} {p.commercial !== null ? `(${p.commercial}m truck)` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Notes</label>
                    <textarea
                      value={form.notes}
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      rows={2}
                      placeholder="Any special instructions or cargo details..."
                      className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={saveShipment}
                    disabled={saving || !form.reference_id}
                    className="flex-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-700 disabled:opacity-40 transition-colors"
                  >
                    {saving ? 'Saving...' : editingShipment ? 'Update' : 'Add Shipment'}
                  </button>
                  <button
                    onClick={() => { setShowAddShipment(false); setEditingShipment(null) }}
                    className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-sm rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Shipments list */}
            {shipments.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center shadow-sm">
                <Package className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">No shipments found.</p>
                <p className="text-xs text-gray-400 mt-1">Add your first shipment to track it here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {shipments.map(s => {
                  const config = STATUS_CONFIG[s.status] || STATUS_CONFIG.scheduled
                  const portData = s.port_id ? ports.find(p => p.portId === s.port_id) : null
                  return (
                    <div key={s.id} className={`rounded-2xl border p-4 shadow-sm ${config.bg} ${s.status === 'delayed' ? 'border-red-200 dark:border-red-800' : 'border-gray-200 dark:border-gray-700'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <span className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${config.dot}`} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{s.reference_id}</span>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-white dark:bg-gray-800 border ${config.color}`}>
                                {config.label}
                              </span>
                              {s.delay_minutes > 0 && (
                                <span className="text-xs text-red-600 font-medium">+{s.delay_minutes}m delay</span>
                              )}
                            </div>
                            {(s.origin || s.destination) && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {s.origin} {s.origin && s.destination ? '→' : ''} {s.destination}
                              </p>
                            )}
                            {s.carrier && <p className="text-xs text-gray-400">{s.carrier}</p>}
                            {s.driver_name && (
                              <p className="text-xs text-gray-400">
                                Driver: {s.driver_name} {s.driver_phone && `· ${s.driver_phone}`}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              {s.expected_crossing_at && (
                                <span className="text-xs text-gray-400">
                                  <Clock className="w-3 h-3 inline mr-0.5" />ETA: {formatDate(s.expected_crossing_at)}
                                </span>
                              )}
                              {portData && (
                                <span className="text-xs text-gray-400">
                                  <Truck className="w-3 h-3 inline mr-0.5" />
                                  {portData.portName}: {portData.commercial ?? portData.vehicle ?? '—'}m
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <select
                            value={s.status}
                            onChange={e => updateStatus(s.id, e.target.value)}
                            className="text-xs border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-200 rounded-lg px-2 py-1 focus:outline-none"
                          >
                            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                              <option key={key} value={key}>{cfg.label}</option>
                            ))}
                          </select>
                          <button onClick={() => openEdit(s)} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteShipment(s.id)} className="p-1.5 text-gray-300 hover:text-red-500">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── COST CALCULATOR TAB ── */}
        {activeTab === 'costs' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                  <DollarSign className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Delay Cost Calculator</h2>
                  <p className="text-xs text-gray-400">Estimate cost impact of border delays on your operations</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                    Average delay per crossing (minutes)
                  </label>
                  <input
                    type="range"
                    min={0} max={240} step={5}
                    value={costDelay}
                    onChange={e => setCostDelay(Number(e.target.value))}
                    className="w-full accent-gray-900 dark:accent-gray-100"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>0</span>
                    <span className="font-bold text-gray-700 dark:text-gray-300">{costDelay} min</span>
                    <span>240</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                    Trucks per day crossing this border
                  </label>
                  <input
                    type="number"
                    min={1} max={500}
                    value={costTrucks}
                    onChange={e => setCostTrucks(Number(e.target.value))}
                    className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                    Driver + truck cost per hour ($)
                  </label>
                  <input
                    type="number"
                    min={20} max={300}
                    value={costRate}
                    onChange={e => setCostRate(Number(e.target.value))}
                    className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Industry average: $75–$95/hr including driver wages, fuel, financing</p>
                </div>
              </div>

              <div className="mt-5 bg-gray-50 dark:bg-gray-700 rounded-2xl p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide font-semibold">Your delay cost</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">${totalCost.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">per day</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-red-600 dark:text-red-400">${annualImpact.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">per year (est.)</p>
                  </div>
                </div>
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                  <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                    Saving even 15 minutes per crossing saves ${Math.round((15 / 60) * costTrucks * costRate * 250).toLocaleString()}/year.
                    Routing to the fastest crossing available can easily save 30–60 minutes per trip.
                  </p>
                </div>
              </div>
            </div>

            {/* Current best crossing cost comparison */}
            {sortedByCommercial.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Cost comparison right now</h3>
                <p className="text-xs text-gray-400 mb-3">Based on {costTrucks} trucks/day at ${costRate}/hr</p>
                <div className="space-y-2">
                  {sortedByCommercial.slice(0, 5).map((p, i) => {
                    const dailyCost = Math.round(((p.commercial ?? 0) / 60) * costTrucks * costRate)
                    const isBest = i === 0
                    return (
                      <div key={p.portId} className={`flex items-center justify-between p-3 rounded-xl ${isBest ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-gray-50 dark:bg-gray-700'}`}>
                        <div>
                          <p className={`text-sm font-semibold ${isBest ? 'text-green-800 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}`}>
                            {isBest && '✓ '}{p.portName}
                          </p>
                          <p className="text-xs text-gray-400">{p.commercial}m truck wait</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold ${isBest ? 'text-green-700 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                            ${dailyCost.toLocaleString()}/day
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PORT INTELLIGENCE TAB ── */}
        {activeTab === 'intel' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Port Intelligence Feed</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">CBP data combined with community reports for a complete operational picture.</p>
            </div>

            {sortedByCommercial.map(port => {
              const level = getWaitLevel(port.commercial ?? port.vehicle)
              const dot = waitLevelDot(level)
              const colors = waitLevelColor(level)
              const reportCount = portReports[port.portId] || 0

              return (
                <div key={port.portId} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{port.portName}</p>
                          <p className="text-xs text-gray-400">{port.crossingName} · {getPortMeta(port.portId).region}</p>
                        </div>
                      </div>
                      <Link href={`/port/${encodeURIComponent(port.portId)}`} className="text-xs text-blue-500 hover:underline">
                        Full report →
                      </Link>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 divide-x divide-gray-100 dark:divide-gray-700">
                    {[
                      { label: 'Car', val: port.vehicle !== null ? `${port.vehicle}m` : '—' },
                      { label: 'Truck', val: port.commercial !== null ? `${port.commercial}m` : '—', highlight: colors },
                      { label: 'SENTRI', val: port.sentri !== null ? `${port.sentri}m` : '—' },
                      { label: 'Reports', val: reportCount > 0 ? `${reportCount}` : '0' },
                    ].map(item => (
                      <div key={item.label} className="p-3 text-center">
                        <p className={`text-lg font-bold ${item.highlight ? item.highlight.split(' ')[0] : 'text-gray-900 dark:text-gray-100'}`}>{item.val}</p>
                        <p className="text-xs text-gray-400">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-5 text-center">
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">Need a custom data feed?</p>
              <p className="text-xs text-gray-400 mb-3">We can integrate live border data directly into your TMS, ERP, or dispatch system via API.</p>
              <a
                href="mailto:cruzabusiness@gmail.com?subject=Custom API Integration"
                className="inline-block text-xs font-semibold text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 px-5 py-2 rounded-xl hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors"
              >
                Contact for API Access
              </a>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
