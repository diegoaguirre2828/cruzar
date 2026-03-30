'use client'

import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { WaitBadge } from '@/components/WaitBadge'
import { ReportForm } from '@/components/ReportForm'
import { ReportsFeed } from '@/components/ReportsFeed'
import { JustCrossedPrompt } from '@/components/JustCrossedPrompt'
import { useAuth } from '@/lib/useAuth'
import { useTier, canAccess } from '@/lib/useTier'
import Link from 'next/link'
import type { PortWaitTime, WaitTimeReading } from '@/types'

interface Prediction {
  datetime: string
  hour: number
  predictedWait: number | null
  confidence: string
}

interface Props {
  port: PortWaitTime
  portId: string
}

interface BestTime {
  hour: number
  avgWait: number
  samples: number
}

function formatHour(hour: number): string {
  if (hour === 0) return '12am'
  if (hour < 12) return `${hour}am`
  if (hour === 12) return '12pm'
  return `${hour - 12}pm`
}

export function PortDetailClient({ port, portId }: Props) {
  const { user } = useAuth()
  const { tier } = useTier()
  const [history, setHistory] = useState<WaitTimeReading[]>([])
  const [bestTimes, setBestTimes] = useState<BestTime[]>([])
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [reportRefresh, setReportRefresh] = useState(0)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [histRes, bestRes, predRes] = await Promise.all([
          fetch(`/api/ports/${encodeURIComponent(portId)}/history`),
          fetch(`/api/ports/${encodeURIComponent(portId)}/best-times`),
          fetch(`/api/predictions?portId=${encodeURIComponent(portId)}`),
        ])
        if (histRes.ok) {
          const { history } = await histRes.json()
          setHistory(history || [])
        }
        if (bestRes.ok) {
          const { bestTimes } = await bestRes.json()
          setBestTimes(bestTimes || [])
        }
        if (predRes.ok) {
          const { predictions } = await predRes.json()
          setPredictions(predictions || [])
        }
      } finally {
        setLoadingHistory(false)
      }
    }
    load()
  }, [portId])

  const chartData = history.map((r) => ({
    time: new Date(r.recorded_at).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }),
    vehicle: r.vehicle_wait,
    pedestrian: r.pedestrian_wait,
  }))

  async function toggleSave() {
    if (!user) return
    setSaving(true)
    if (saved) {
      await fetch(`/api/saved?portId=${encodeURIComponent(portId)}`, { method: 'DELETE' })
      setSaved(false)
    } else {
      await fetch('/api/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portId }),
      })
      setSaved(true)
    }
    setSaving(false)
  }

  const predictionChartData = predictions
    .filter(p => p.predictedWait !== null)
    .map(p => ({
      time: new Date(p.datetime).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }),
      predicted: p.predictedWait,
      confidence: p.confidence,
    }))

  return (
    <div className="space-y-4">
      <JustCrossedPrompt
        portId={portId}
        portName={port.portName}
        onSubmitted={() => setReportRefresh(r => r + 1)}
      />
      {/* Save button */}
      {user && (
        <button
          onClick={toggleSave}
          disabled={saving}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
            saved
              ? 'bg-yellow-50 border-yellow-300 text-yellow-700'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          {saved ? '⭐ Saved to Dashboard' : '☆ Save to Dashboard'}
        </button>
      )}

      {/* Current wait times */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Current Wait Times</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col items-center p-3 bg-gray-50 rounded-xl">
            <span className="text-xs text-gray-500 mb-1">Passenger Vehicle</span>
            <WaitBadge minutes={port.vehicle} label="" />
          </div>
          <div className="flex flex-col items-center p-3 bg-gray-50 rounded-xl">
            <span className="text-xs text-gray-500 mb-1">SENTRI / Ready Lane</span>
            <WaitBadge minutes={port.sentri} label="" />
          </div>
          <div className="flex flex-col items-center p-3 bg-gray-50 rounded-xl">
            <span className="text-xs text-gray-500 mb-1">Pedestrian</span>
            <WaitBadge minutes={port.pedestrian} label="" />
          </div>
          <div className="flex flex-col items-center p-3 bg-gray-50 rounded-xl">
            <span className="text-xs text-gray-500 mb-1">Commercial / Truck</span>
            <WaitBadge minutes={port.commercial} label="" />
          </div>
        </div>
      </div>

      {/* 24-hour history chart */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Last 24 Hours</h2>
        {loadingHistory ? (
          <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
        ) : chartData.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            Not enough data yet. Check back after a few hours.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 10 }} unit=" min" width={45} />
              <Tooltip
                formatter={(value) => [`${value} min`, '']}
                contentStyle={{ fontSize: 12 }}
              />
              <Line
                type="monotone"
                dataKey="vehicle"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name="Vehicle"
              />
              <Line
                type="monotone"
                dataKey="pedestrian"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                name="Pedestrian"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
        <div className="flex gap-4 mt-2 text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block" /> Vehicle</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-500 inline-block" /> Pedestrian</span>
        </div>
      </div>

      {/* AI Predictions — Pro+ only */}
      {canAccess(tier, 'ai_predictions') ? (
        predictionChartData.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">AI Prediction – Next 24 Hours</h2>
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Beta</span>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={predictionChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="time" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} unit=" min" width={45} />
                <Tooltip formatter={(value) => [`${value} min`, 'Predicted']} contentStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="predicted" stroke="#8b5cf6" strokeWidth={2} dot={false} strokeDasharray="5 3" name="Predicted" />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-400 mt-2">Based on historical patterns for this crossing</p>
          </div>
        )
      ) : (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 text-center">
          <p className="text-sm font-semibold text-purple-800">🤖 AI Wait Predictions</p>
          <p className="text-xs text-purple-600 mt-1 mb-3">See predicted wait times for the next 24 hours. Pro feature.</p>
          <Link href="/pricing" className="inline-block bg-purple-600 text-white text-xs font-medium px-4 py-2 rounded-full hover:bg-purple-700 transition-colors">
            Upgrade to Pro →
          </Link>
        </div>
      )}

      {/* Best times today — Pro+ only */}
      {canAccess(tier, 'ai_predictions') && bestTimes.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Best Times Today <span className="text-gray-400 font-normal">(based on history)</span>
          </h2>
          <div className="space-y-2">
            {bestTimes.map((bt, i) => (
              <div key={bt.hour} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
                  <span className="text-sm font-medium text-gray-800">{formatHour(bt.hour)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-green-600 font-semibold">~{bt.avgWait} min avg</span>
                  <span className="text-xs text-gray-400">({bt.samples} readings)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Driver reports feed */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Driver Reports</h2>
        <ReportsFeed portId={portId} refresh={reportRefresh} />
      </div>

      {/* Submit report */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Submit a Report</h2>
        <ReportForm portId={portId} onSubmitted={() => setReportRefresh(r => r + 1)} />
      </div>

      {/* Pro teaser */}
      {!user && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
          <p className="text-sm font-semibold text-blue-800">🔔 Get alerts when wait drops</p>
          <p className="text-xs text-blue-600 mt-1">
            Upgrade to Pro for $2.99/mo — get notified the moment your crossing clears up.
          </p>
          <a
            href="/pricing"
            className="inline-block mt-3 bg-blue-600 text-white text-sm font-medium px-5 py-2 rounded-full hover:bg-blue-700 transition-colors"
          >
            Try Pro Free for 7 Days
          </a>
        </div>
      )}
    </div>
  )
}
