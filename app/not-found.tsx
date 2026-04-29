import Link from 'next/link'
import { BridgeLogo } from '@/components/BridgeLogo'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="flex justify-center mb-4"><BridgeLogo size={72} /></div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Página no encontrada · Page not found
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
          Parece que este puente no existe. Te regresamos al inicio. · Looks like this bridge doesn&apos;t exist. Let&apos;s get you back on the road.
        </p>
        <Link
          href="/"
          className="inline-block bg-gray-900 dark:bg-gray-700 text-white font-medium px-6 py-2.5 rounded-xl hover:bg-gray-700 dark:hover:bg-gray-600 transition-all active:scale-95 text-sm"
        >
          Volver a Cruzar · Back to Cruzar
        </Link>
      </div>
    </main>
  )
}
