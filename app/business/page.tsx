'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { getWaitLevel, waitLevelDot, waitLevelColor } from '@/lib/cbp'
import { getPortMeta } from '@/lib/portMeta'
import {
  ArrowLeft, RefreshCw, Package, Truck, Clock, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, Plus, X, Pencil, DollarSign, Users, Map,
  ChevronDown, ChevronUp, Filter, Download, Link2, UserCheck, Phone, Building2
} from 'lucide-react'
import type { PortWaitTime } from '@/types'

interface Driver {
  id: string
  name: string
  phone: string | null
  carrier: string | null
  checkin_token: string
  current_status: string
  current_port_id: string | null
  last_checkin_at: string | null
  notes: string | null
}

const DRIVER_STATUS: Record<string, { label: string; labelEs: string; emoji: string; color: string; dot: string }> = {
  available:  { label: 'Available',   labelEs: 'Disponible',   emoji: '🟢', color: 'text-gray-500',   dot: 'bg-gray-400' },
  en_route:   { label: 'En Route',    labelEs: 'En Camino',    emoji: '🚛', color: 'text-blue-600',   dot: 'bg-blue-400' },
  in_line:    { label: 'In Line',     labelEs: 'En Fila',      emoji: '⏳', color: 'text-yellow-600', dot: 'bg-yellow-400 animate-pulse' },
  at_bridge:  { label: 'At Bridge',   labelEs: 'En el Puente', emoji: '🌉', color: 'text-orange-600', dot: 'bg-orange-400 animate-pulse' },
  cleared:    { label: 'Cleared',     labelEs: 'Pasó',         emoji: '✅', color: 'text-green-600',  dot: 'bg-green-400' },
  delivered:  { label: 'Delivered',   labelEs: 'Entregado',    emoji: '📦', color: 'text-gray-500',   dot: 'bg-gray-300' },
}

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
  broker_email: string | null
  broker_name: string | null
}

// ── Feature 1: Holiday Surge Alerts ──
const BORDER_HOLIDAYS = [
  { name: "New Year's Day", month: 1, day: 1 },
  { name: "Presidents Day", month: 2, day: 17 },
  { name: "Memorial Day", month: 5, day: 26 },
  { name: "Independence Day", month: 7, day: 4 },
  { name: "Labor Day", month: 9, day: 1 },
  { name: "Thanksgiving", month: 11, day: 27 },
  { name: "Christmas", month: 12, day: 25 },
  { name: "Año Nuevo (MX)", month: 1, day: 1 },
  { name: "Día de la Constitución", month: 2, day: 3 },
  { name: "Natalicio de Benito Juárez", month: 3, day: 17 },
  { name: "Semana Santa", month: 4, day: 14 },
  { name: "Día del Trabajo (MX)", month: 5, day: 1 },
  { name: "Día de la Independencia", month: 9, day: 16 },
  { name: "Día de Muertos", month: 11, day: 2 },
  { name: "Día de la Revolución", month: 11, day: 17 },
  { name: "Navidad (MX)", month: 12, day: 25 },
]

function getUpcomingHolidays(): { name: string; daysAway: number }[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const results: { name: string; daysAway: number }[] = []
  for (const h of BORDER_HOLIDAYS) {
    const year = today.getFullYear()
    for (const y of [year, year + 1]) {
      const hDate = new Date(y, h.month - 1, h.day)
      hDate.setHours(0, 0, 0, 0)
      const diff = Math.round((hDate.getTime() - today.getTime()) / 86400000)
      if (diff >= 0 && diff <= 7) {
        results.push({ name: h.name, daysAway: diff })
      }
    }
  }
  // deduplicate by name
  const seen = new Set<string>()
  return results.filter(r => { if (seen.has(r.name)) return false; seen.add(r.name); return true })
}

// ── Feature 2: Best Crossing Windows — crossing options ──
const CROSSING_OPTIONS = [
  { id: '230501', label: 'Hidalgo / McAllen' },
  { id: '230502', label: 'Pharr–Reynosa' },
  { id: '230401', label: 'Laredo I (Gateway)' },
  { id: '230402', label: 'Laredo II (World Trade)' },
  { id: '535501', label: 'Brownsville Gateway' },
  { id: '230301', label: 'Eagle Pass I' },
  { id: '240201', label: 'El Paso' },
]

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

function BusinessPortalPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [ports, setPorts] = useState<PortWaitTime[]>([])
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [trends, setTrends] = useState<Record<string, { vehicle: string; commercial: string }>>({})
  const [tier, setTier] = useState<string>('')
  const [cbpUpdatedAt, setCbpUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const initialTab = (searchParams?.get('tab') ?? 'drivers') as 'dispatch' | 'drivers' | 'shipments' | 'costs' | 'intel'
  const [activeTab, setActiveTab] = useState<'dispatch' | 'drivers' | 'shipments' | 'costs' | 'intel'>(initialTab)
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAddShipment, setShowAddShipment] = useState(false)
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null)
  const [showAddDriver, setShowAddDriver] = useState(false)
  const [driverForm, setDriverForm] = useState({ name: '', phone: '', carrier: '', notes: '', dispatcher_phone: '' })
  const [savingDriver, setSavingDriver] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [costDelay, setCostDelay] = useState(60)
  const [costTrucks, setCostTrucks] = useState(5)
  const [costRate, setCostRate] = useState(DELAY_COST_PER_HOUR)

  const blankForm = {
    reference_id: '', description: '', origin: '', destination: '',
    port_id: '', carrier: '', driver_name: '', driver_phone: '',
    expected_crossing_at: '', notes: '',
    broker_name: '', broker_email: '',
  }
  const [form, setForm] = useState(blankForm)

  // Feature 2: Best Crossing Windows state
  const [bestWindowsPort, setBestWindowsPort] = useState('230501')
  const [bestTimes, setBestTimes] = useState<{ hour: number; avgWait: number; samples: number }[]>([])
  const [bestTimesLoading, setBestTimesLoading] = useState(false)

  // Feature 3: Route All Trucks state
  const [routeRecommendation, setRouteRecommendation] = useState<{ portName: string; commercialWait: number | null; region: string } | null>(null)
  const [routingLoading, setRoutingLoading] = useState(false)

  const loadPorts = useCallback(async () => {
    const [portsRes, trendsRes] = await Promise.all([
      fetch('/api/ports'),
      fetch('/api/ports/trends'),
    ])
    if (portsRes.ok) {
      const d = await portsRes.json()
      setPorts(d.ports || [])
      setCbpUpdatedAt(d.cbpUpdatedAt ?? null)
    }
    if (trendsRes.ok) {
      const d = await trendsRes.json()
      setTrends(d.trends || {})
    }
  }, [])

  const loadShipments = useCallback(async () => {
    const res = await fetch(`/api/business/shipments?status=${statusFilter}`)
    if (res.ok) {
      const d = await res.json()
      setShipments(d.shipments || [])
    }
  }, [statusFilter])

  const loadDrivers = useCallback(async () => {
    const res = await fetch('/api/business/drivers')
    if (res.ok) {
      const d = await res.json()
      setDrivers(d.drivers || [])
    }
  }, [])

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
    if (user) {
      fetch('/api/profile').then(r => r.json()).then(d => {
        const t = d.profile?.tier || 'free'
        setTier(t)
        if (t !== 'business') router.push('/pricing')
      })
      Promise.all([loadPorts(), loadShipments(), loadDrivers()]).then(() => setLoading(false))
    }
  }, [user, authLoading, router, loadPorts, loadShipments])

  useEffect(() => { loadShipments() }, [statusFilter, loadShipments])

  async function saveDriver() {
    setSavingDriver(true)
    await fetch('/api/business/drivers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(driverForm),
    })
    setSavingDriver(false)
    setShowAddDriver(false)
    setDriverForm({ name: '', phone: '', carrier: '', notes: '', dispatcher_phone: '' })
    loadDrivers()
  }

  async function deleteDriver(id: string) {
    await fetch(`/api/business/drivers?id=${id}`, { method: 'DELETE' })
    loadDrivers()
  }

  function copyCheckinLink(token: string) {
    const url = `${window.location.origin}/driver/${token}`
    navigator.clipboard.writeText(url)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2500)
  }

  // Auto-refresh drivers + ports every 30s when on drivers or dispatch tab
  const refreshInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (activeTab === 'drivers' || activeTab === 'dispatch') {
      refreshInterval.current = setInterval(() => {
        loadDrivers()
        loadPorts()
      }, 30000)
    }
    return () => {
      if (refreshInterval.current) clearInterval(refreshInterval.current)
    }
  }, [activeTab, loadDrivers, loadPorts])

  // Flag drivers who haven't checked in for 2+ hours while actively at bridge
  function isSilent(driver: Driver): boolean {
    if (!['in_line', 'at_bridge'].includes(driver.current_status)) return false
    if (!driver.last_checkin_at) return true
    const diffMs = Date.now() - new Date(driver.last_checkin_at).getTime()
    return diffMs > 2 * 60 * 60 * 1000 // 2 hours
  }

  function whatsappLink(driver: Driver): string {
    const checkinUrl = `${window.location.origin}/driver/${driver.checkin_token}`
    const msg = encodeURIComponent(`Hi ${driver.name}, please tap this link to update your border status: ${checkinUrl}`)
    if (driver.phone) {
      const digits = driver.phone.replace(/\D/g, '')
      return `https://wa.me/${digits}?text=${msg}`
    }
    return `https://wa.me/?text=${msg}`
  }

  function timeAgo(iso: string | null): string {
    if (!iso) return 'Never'
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    if (mins < 1440) return `${Math.round(mins / 60)}h ago`
    return `${Math.round(mins / 1440)}d ago`
  }

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
      broker_name: s.broker_name || '',
      broker_email: s.broker_email || '',
    })
    setEditingShipment(s)
    setShowAddShipment(true)
  }

  // Feature 3: Route All Trucks
  async function routeAllTrucks() {
    setRoutingLoading(true)
    try {
      const res = await fetch('/api/route-optimize?origin=McAllen&urgency=freight')
      if (res.ok) {
        const d = await res.json()
        const best = d.best
        if (best) {
          setRouteRecommendation({
            portName: best.portName || best.crossingName || best.name || 'Best crossing',
            commercialWait: best.commercial ?? best.commercialWait ?? null,
            region: best.region || best.city || 'RGV',
          })
        }
      }
    } catch {}
    setRoutingLoading(false)
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

  // Dispatch cost impact
  const worstCommercial = Math.max(0, ...ports.map(p => p.commercial ?? 0))
  const activeAtBorder = drivers.filter(d => ['in_line', 'at_bridge'].includes(d.current_status))
  const liveDelayCost = activeAtBorder.reduce((sum, d) => {
    const wait = ports.find(p => p.portId === d.current_port_id)?.commercial ?? 0
    return sum + Math.round((wait / 60) * DELAY_COST_PER_HOUR)
  }, 0)

  // Feature 1: Holiday surge alerts
  const upcomingHolidays = getUpcomingHolidays()

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

  // Feature 2: Fetch best times when intel tab opens or port selection changes
  useEffect(() => {
    if (activeTab !== 'intel') return
    setBestTimesLoading(true)
    fetch(`/api/ports/${bestWindowsPort}/best-times`)
      .then(r => r.json())
      .then(d => setBestTimes(d.bestTimes || []))
      .catch(() => setBestTimes([]))
      .finally(() => setBestTimesLoading(false))
  }, [activeTab, bestWindowsPort])

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
        {/* Business Header — unmistakably a separate product */}
        <div className="bg-blue-600 dark:bg-blue-700 -mx-4 px-4 pt-10 pb-5 mb-5">
          <div className="flex items-start justify-between">
            <div>
              <Link href="/" className="flex items-center gap-1 text-xs text-blue-200 hover:text-white mb-2 transition-colors">
                <ArrowLeft className="w-3 h-3" /> Back to Cruzar
              </Link>
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-5 h-5 text-white" />
                <h1 className="text-xl font-bold text-white">Cruzar Business</h1>
                <span className="bg-blue-500/60 text-blue-100 text-xs font-semibold px-2 py-0.5 rounded-full">PRO</span>
              </div>
              <p className="text-sm text-blue-200">Your fleet command center</p>
              {cbpTime && <p className="text-xs text-blue-300 mt-0.5">CBP data updated {cbpTime}</p>}
            </div>
            <button
              onClick={() => { loadPorts(); loadShipments(); loadDrivers() }}
              className="p-2 rounded-xl bg-blue-500/40 text-blue-100 hover:bg-blue-500/60 transition-colors mt-1"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick stats bar — fleet + shipments */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-3 shadow-sm text-center">
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
              {drivers.filter(d => ['en_route','in_line','at_bridge'].includes(d.current_status)).length}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Drivers active</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-3 shadow-sm text-center">
            <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{activeShipments}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Crossing</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-3 shadow-sm text-center">
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{scheduledToday}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Today</p>
          </div>
          <div className={`rounded-2xl border p-3 shadow-sm text-center ${delayedShipments > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
            <p className={`text-xl font-bold ${delayedShipments > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>{delayedShipments}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Delayed</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-xl p-1 mb-5 gap-1 overflow-x-auto">
          {[
            { key: 'drivers',   label: '👥 Drivers' },
            { key: 'dispatch',  label: '🗺️ Dispatch' },
            { key: 'shipments', label: '📦 Loads' },
            { key: 'costs',     label: '💰 Costs' },
            { key: 'intel',     label: '📡 Intel' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as typeof activeTab)}
              className={`flex-shrink-0 py-2 px-3 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                activeTab === t.key
                  ? 'bg-blue-600 shadow text-white'
                  : 'text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/20'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── DRIVERS TAB ── */}
        {activeTab === 'drivers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Driver Tracking Board</h2>
                <p className="text-xs text-gray-400 mt-0.5">Send each driver a check-in link. They tap to update their status — no app download needed.</p>
              </div>
              <button
                onClick={() => setShowAddDriver(true)}
                className="flex items-center gap-1 text-xs font-semibold bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-2 rounded-xl hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors flex-shrink-0 ml-3"
              >
                <Plus className="w-3.5 h-3.5" /> Add Driver
              </button>
            </div>

            {/* Add driver form */}
            {showAddDriver && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Add Driver</h3>
                  <button onClick={() => setShowAddDriver(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  <input
                    value={driverForm.name}
                    onChange={e => setDriverForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Driver name *"
                    className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      value={driverForm.phone}
                      onChange={e => setDriverForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="Driver phone (optional)"
                      className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      value={driverForm.carrier}
                      onChange={e => setDriverForm(f => ({ ...f, carrier: e.target.value }))}
                      placeholder="Carrier (optional)"
                      className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="relative">
                    <input
                      value={driverForm.dispatcher_phone}
                      onChange={e => setDriverForm(f => ({ ...f, dispatcher_phone: e.target.value }))}
                      placeholder="Your WhatsApp number — driver will message you here"
                      className="w-full border border-green-300 dark:border-green-700 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <span className="absolute right-3 top-2 text-base">📲</span>
                  </div>
                  <p className="text-xs text-gray-400">Include country code — e.g. <span className="font-mono">19561234567</span> for US numbers</p>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={saveDriver}
                    disabled={savingDriver || !driverForm.name}
                    className="flex-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-700 disabled:opacity-40 transition-colors"
                  >
                    {savingDriver ? 'Saving...' : 'Add Driver'}
                  </button>
                  <button onClick={() => setShowAddDriver(false)} className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-sm rounded-xl">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* How it works */}
            {drivers.length === 0 && !showAddDriver && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-5">
                <p className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-2">How driver tracking works</p>
                <ol className="space-y-2">
                  {[
                    'Add your drivers above',
                    'Copy each driver\'s unique check-in link',
                    'Send the link via WhatsApp or SMS',
                    'Drivers tap the link to update their status — no account needed',
                    'See all drivers live on this board',
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-blue-700 dark:text-blue-300">
                      <span className="font-bold flex-shrink-0">{i + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Drivers list */}
            {drivers.length > 0 && (
              <>
                {/* Status summary */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'In transit', count: drivers.filter(d => ['en_route','in_line','at_bridge'].includes(d.current_status)).length, color: 'text-yellow-600' },
                    { label: 'Cleared today', count: drivers.filter(d => d.current_status === 'cleared').length, color: 'text-green-600' },
                    { label: 'Available', count: drivers.filter(d => d.current_status === 'available').length, color: 'text-gray-500' },
                  ].map(item => (
                    <div key={item.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 text-center">
                      <p className={`text-2xl font-bold ${item.color}`}>{item.count}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{item.label}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  {drivers.map(driver => {
                    const statusCfg = DRIVER_STATUS[driver.current_status] || DRIVER_STATUS.available
                    const portName = driver.current_port_id
                      ? ports.find(p => p.portId === driver.current_port_id)?.portName
                      : null
                    const currentWait = driver.current_port_id
                      ? ports.find(p => p.portId === driver.current_port_id)?.commercial
                      : null
                    const isCopied = copiedToken === driver.checkin_token
                    const silent = isSilent(driver)

                    return (
                      <div key={driver.id} className={`bg-white dark:bg-gray-800 rounded-2xl border p-4 shadow-sm ${silent ? 'border-orange-300 dark:border-orange-700' : 'border-gray-200 dark:border-gray-700'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <span className="text-xl mt-0.5">{statusCfg.emoji}</span>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{driver.name}</p>
                                <span className={`text-xs font-medium ${statusCfg.color}`}>
                                  {statusCfg.label} · {statusCfg.labelEs}
                                </span>
                                {silent && (
                                  <span className="text-xs font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 px-2 py-0.5 rounded-full">
                                    ⚠️ No check-in 2h+
                                  </span>
                                )}
                              </div>
                              {driver.carrier && <p className="text-xs text-gray-400">{driver.carrier}</p>}
                              {driver.phone && (
                                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                  <Phone className="w-3 h-3" />{driver.phone}
                                </p>
                              )}
                              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                {portName && (
                                  <span className="text-xs text-gray-400">
                                    📍 {portName} {currentWait !== null && currentWait !== undefined ? `· ${currentWait}m truck` : ''}
                                  </span>
                                )}
                                <span className="text-xs text-gray-400">
                                  <Clock className="w-3 h-3 inline mr-0.5" />
                                  {timeAgo(driver.last_checkin_at)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <a
                              href={whatsappLink(driver)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl border bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                              title="Send check-in link via WhatsApp"
                            >
                              <Phone className="w-3 h-3" />
                              WA
                            </a>
                            <button
                              onClick={() => copyCheckinLink(driver.checkin_token)}
                              className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl border transition-colors ${
                                isCopied
                                  ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400'
                                  : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                              }`}
                              title="Copy check-in link to send to driver"
                            >
                              <Link2 className="w-3 h-3" />
                              {isCopied ? 'Copied!' : 'Link'}
                            </button>
                            <button
                              onClick={() => deleteDriver(driver.id)}
                              className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-4 text-center">
                  <p className="text-xs text-gray-400">
                    Share each driver's link via <strong>WhatsApp</strong> or SMS.<br />
                    They update their status — you see it here instantly.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── DISPATCH TAB ── */}
        {activeTab === 'dispatch' && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Live Dispatcher Board</h2>
                <p className="text-xs text-gray-400 dark:text-gray-500">Ranked by commercial (truck) wait time. Click a crossing to view details.</p>
              </div>
              {/* Feature 3: Route All Trucks button */}
              <button
                onClick={routeAllTrucks}
                disabled={routingLoading}
                className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-2 rounded-xl transition-colors"
              >
                <Map className="w-3.5 h-3.5" />
                {routingLoading ? 'Routing...' : 'Route All Trucks'}
              </button>
            </div>

            {/* Feature 3: Route recommendation card */}
            {routeRecommendation && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-1">
                      → Best crossing: {routeRecommendation.portName}
                    </p>
                    {routeRecommendation.commercialWait !== null && (
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        {routeRecommendation.commercialWait} min commercial wait · {routeRecommendation.region}
                      </p>
                    )}
                    <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">
                      Send this to all active drivers:
                    </p>
                  </div>
                  <button
                    onClick={() => setRouteRecommendation(null)}
                    className="text-blue-400 hover:text-blue-600 flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {drivers.filter(d => ['en_route', 'in_line'].includes(d.current_status)).map(driver => {
                    const msg = encodeURIComponent(
                      `🚛 Dispatch recommendation: Head to ${routeRecommendation.portName} — only ${routeRecommendation.commercialWait ?? '?'} min commercial wait right now. ${routeRecommendation.region}`
                    )
                    const digits = (driver.phone || '').replace(/\D/g, '')
                    const waUrl = digits
                      ? `https://wa.me/${digits}?text=${msg}`
                      : `https://wa.me/?text=${msg}`
                    return (
                      <a
                        key={driver.id}
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs font-medium bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-xl transition-colors"
                      >
                        <Phone className="w-3 h-3" />
                        WA {driver.name}
                      </a>
                    )
                  })}
                  {drivers.filter(d => ['en_route', 'in_line'].includes(d.current_status)).length === 0 && (
                    <p className="text-xs text-blue-500 italic">No drivers currently en route or in line.</p>
                  )}
                </div>
              </div>
            )}

            {/* Live driver cost banner */}
            {activeAtBorder.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">🚛</span>
                  <div>
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                      {activeAtBorder.length} driver{activeAtBorder.length > 1 ? 's' : ''} at the border right now
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Current delays costing ~${liveDelayCost}/hr in driver time
                    </p>
                  </div>
                </div>
                <span className="text-xl font-bold text-amber-700 dark:text-amber-300">${liveDelayCost}<span className="text-xs font-normal">/hr</span></span>
              </div>
            )}

            {/* Best ports highlight */}
            {bestPorts.length > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <p className="text-sm font-semibold text-green-800 dark:text-green-300">Recommended crossings right now</p>
                </div>
                <div className="space-y-2">
                  {bestPorts.slice(0, 3).map((p, i) => {
                    const savings = worstCommercial > 0 && p.commercial !== null
                      ? Math.round(((worstCommercial - p.commercial) / 60) * DELAY_COST_PER_HOUR)
                      : 0
                    const trend = trends[p.portId]?.commercial
                    return (
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
                            <div className="flex items-center gap-1 justify-end">
                              <p className="text-lg font-bold text-green-700 dark:text-green-400">{p.commercial} min</p>
                              {trend === 'down' && <span className="text-green-500 text-sm">↓</span>}
                              {trend === 'up' && <span className="text-red-500 text-sm">↑</span>}
                            </div>
                            {savings > 0 && (
                              <p className="text-xs text-green-600 font-medium">saves ~${savings}/truck</p>
                            )}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
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
                              <div className="flex items-center justify-center gap-1">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${colors}`}>
                                  {port.commercial !== null ? `${port.commercial}m` : '—'}
                                </span>
                                {trends[port.portId]?.commercial === 'up' && <span className="text-red-500 text-xs">↑</span>}
                                {trends[port.portId]?.commercial === 'down' && <span className="text-green-500 text-xs">↓</span>}
                              </div>
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
                  {/* Feature 5A: Broker fields */}
                  <div className="col-span-1">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Customs broker name (optional)</label>
                    <input
                      value={form.broker_name}
                      onChange={e => setForm(f => ({ ...f, broker_name: e.target.value }))}
                      placeholder="e.g. Acme Customs Brokers"
                      className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Customs broker email — notified when shipment clears</label>
                    <input
                      type="email"
                      value={form.broker_email}
                      onChange={e => setForm(f => ({ ...f, broker_email: e.target.value }))}
                      placeholder="broker@example.com"
                      className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  // ETA = expected crossing time + current truck wait at that port
                  const etaMs = (() => {
                    if (!s.expected_crossing_at || !portData?.commercial) return null
                    return new Date(s.expected_crossing_at).getTime() + portData.commercial * 60 * 1000
                  })()
                  const etaStr = etaMs ? new Date(etaMs).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : null
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
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                  (portData.commercial ?? portData.vehicle ?? 999) < 20
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                    : (portData.commercial ?? portData.vehicle ?? 999) < 45
                                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                }`}>
                                  <Truck className="w-3 h-3 inline mr-0.5" />
                                  {portData.portName}: {portData.commercial ?? portData.vehicle ?? '—'}m
                                </span>
                              )}
                              {etaStr && (
                                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                  🏁 Est. cleared: {etaStr}
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
                          {/* Feature 4: Delay Report link */}
                          {s.delay_minutes > 0 && (() => {
                            const portName = s.port_id ? ports.find(p => p.portId === s.port_id)?.portName || s.port_id : ''
                            const params = new URLSearchParams({
                              ref: s.reference_id,
                              driver: s.driver_name || '',
                              origin: s.origin || '',
                              destination: s.destination || '',
                              port: portName,
                              expected: s.expected_crossing_at || '',
                              actual: s.actual_crossing_at || '',
                              delay: String(s.delay_minutes),
                              carrier: s.carrier || '',
                            })
                            return (
                              <Link
                                href={`/business/delay-report?${params.toString()}`}
                                className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                title="Generate delay report"
                                target="_blank"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </Link>
                            )
                          })()}
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

            {/* Feature 1: Holiday Surge Alerts */}
            {upcomingHolidays.length > 0 && (
              <div className="space-y-2">
                {upcomingHolidays.map(h => (
                  <div key={h.name} className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${
                    h.daysAway <= 1
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                  }`}>
                    <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${h.daysAway <= 1 ? 'text-red-500' : 'text-amber-500'}`} />
                    <div>
                      <p className={`text-sm font-semibold ${h.daysAway <= 1 ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'}`}>
                        ⚠️ Heavy crossing expected: {h.name} {h.daysAway === 0 ? 'is today' : `is in ${h.daysAway} day${h.daysAway > 1 ? 's' : ''}`}
                      </p>
                      <p className={`text-xs mt-0.5 ${h.daysAway <= 1 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        Plan shipments accordingly — expect significantly longer commercial wait times.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Feature 2: Best Times to Cross This Week */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Best Times to Cross This Week</p>
                </div>
                <select
                  value={bestWindowsPort}
                  onChange={e => setBestWindowsPort(e.target.value)}
                  className="text-xs border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CROSSING_OPTIONS.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>

              {bestTimesLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {/* Best window callout */}
                  {bestTimes.length > 0 && (() => {
                    const best = [...bestTimes].filter(t => t.samples > 0).sort((a, b) => a.avgWait - b.avgWait)[0]
                    if (!best) return null
                    const hourLabel = best.hour === 0 ? '12 AM' : best.hour < 12 ? `${best.hour} AM` : best.hour === 12 ? '12 PM' : `${best.hour - 12} PM`
                    return (
                      <div className="mb-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-3 py-2">
                        <p className="text-xs font-semibold text-green-800 dark:text-green-300">
                          Best window: {hourLabel} (~{Math.round(best.avgWait)} min avg commercial)
                        </p>
                      </div>
                    )
                  })()}

                  {/* Hour grid: 6am–10pm */}
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: 17 }, (_, i) => i + 6).map(hour => {
                      const entry = bestTimes.find(t => t.hour === hour)
                      const wait = entry?.avgWait ?? null
                      const hasData = entry && entry.samples > 0
                      const colorClass = !hasData
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                        : wait! <= 20
                        ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800'
                        : wait! <= 45
                        ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800'
                        : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
                      const label = hour === 12 ? '12p' : hour < 12 ? `${hour}a` : `${hour - 12}p`
                      return (
                        <div
                          key={hour}
                          className={`rounded-lg px-2 py-1.5 text-center min-w-[2.75rem] ${colorClass}`}
                          title={hasData ? `${label}: ~${Math.round(wait!)} min avg (${entry!.samples} samples)` : `${label}: no data`}
                        >
                          <p className="text-xs font-bold leading-tight">{label}</p>
                          <p className="text-xs leading-tight">{hasData ? `${Math.round(wait!)}m` : '—'}</p>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="flex items-center gap-1 text-xs text-gray-400"><span className="w-2 h-2 rounded-sm bg-green-300 inline-block" /> ≤20m</span>
                    <span className="flex items-center gap-1 text-xs text-gray-400"><span className="w-2 h-2 rounded-sm bg-yellow-300 inline-block" /> 21–45m</span>
                    <span className="flex items-center gap-1 text-xs text-gray-400"><span className="w-2 h-2 rounded-sm bg-red-300 inline-block" /> 45m+</span>
                    <span className="flex items-center gap-1 text-xs text-gray-400"><span className="w-2 h-2 rounded-sm bg-gray-300 inline-block" /> No data</span>
                  </div>
                </>
              )}
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

            {/* Data Export */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Export Historical Data</h3>
              <p className="text-xs text-gray-400 mb-3">Download wait time readings as CSV for your own analysis or reporting.</p>
              <div className="flex flex-wrap gap-2">
                {[7, 30, 90].map(days => (
                  <a
                    key={days}
                    href={`/api/export?days=${days}`}
                    download
                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-3 py-2 rounded-xl transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Last {days} days
                  </a>
                ))}
              </div>
            </div>

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


export default function BusinessPortalPageWrapper() {
  return (
    <Suspense>
      <BusinessPortalPage />
    </Suspense>
  )
}
