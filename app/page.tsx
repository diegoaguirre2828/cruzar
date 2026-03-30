import { PortList } from '@/components/PortList'
import { NavBar } from '@/components/NavBar'

export const metadata = {
  title: 'Cruza – How Long to Enter the US from Mexico',
  description: 'Live wait times to cross from Mexico into the US at all 52 border ports. Free for commuters and freight.',
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 pb-10">
        <div className="pt-8 pb-2 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🌉 Cruza</h1>
            <p className="text-sm text-gray-500 mt-0.5">Wait times entering the US from Mexico</p>
          </div>
          <NavBar />
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
