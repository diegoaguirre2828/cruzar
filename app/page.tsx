import { PortList } from '@/components/PortList'

export const metadata = {
  title: 'RGV Border Wait Times',
  description: 'Live and predicted wait times for all RGV US-Mexico border crossings',
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 pb-10">
        <div className="pt-8 pb-4">
          <h1 className="text-2xl font-bold text-gray-900">🌉 RGV Border Waits</h1>
          <p className="text-sm text-gray-500 mt-1">
            Live wait times · US-Mexico crossings
          </p>
        </div>

        <div className="flex gap-4 mb-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Under 20 min
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> 20–45 min
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> 45+ min
          </span>
        </div>

        <PortList />
      </div>
    </main>
  )
}
