'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Camera, BarChart3 } from 'lucide-react'
import { useLang } from '@/lib/LangContext'

export function ProTabSwitcher() {
  const pathname = usePathname()
  const { lang } = useLang()
  const es = lang === 'es'
  const onCamaras = pathname.startsWith('/camaras')
  const onDatos = pathname.startsWith('/datos')

  const activeStyle = 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
  const idleStyle = 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'

  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-full bg-gray-100 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700">
      <Link
        href="/camaras"
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${onCamaras ? activeStyle : idleStyle}`}
      >
        <Camera className="w-3.5 h-3.5" />
        {es ? 'Cámaras' : 'Cameras'}
      </Link>
      <Link
        href="/datos"
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${onDatos ? activeStyle : idleStyle}`}
      >
        <BarChart3 className="w-3.5 h-3.5" />
        {es ? 'Datos' : 'Insights'}
      </Link>
    </div>
  )
}
