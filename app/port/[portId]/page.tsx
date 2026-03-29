import { fetchRgvWaitTimes } from '@/lib/cbp'
import { PortDetailClient } from './PortDetailClient'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface Props {
  params: Promise<{ portId: string }>
}

export default async function PortDetailPage({ params }: Props) {
  const { portId } = await params
  const decodedId = decodeURIComponent(portId)

  const ports = await fetchRgvWaitTimes()
  const port = ports.find((p) => p.portId === decodedId)

  if (!port) notFound()

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 pb-10">
        <div className="pt-6 pb-4">
          <Link href="/" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
            <ArrowLeft className="w-4 h-4" /> All crossings
          </Link>
          <h1 className="text-xl font-bold text-gray-900">{port.portName}</h1>
          <p className="text-sm text-gray-400">{port.crossingName}</p>
        </div>

        <PortDetailClient port={port} portId={decodedId} />
      </div>
    </main>
  )
}
