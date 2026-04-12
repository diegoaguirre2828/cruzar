'use client'

import { Bell, BellOff } from 'lucide-react'
import { usePushNotifications } from '@/lib/usePushNotifications'
import { useLang } from '@/lib/LangContext'

export function PushToggle() {
  const { supported, subscribed, loading, subscribe, unsubscribe } = usePushNotifications()
  const { lang } = useLang()
  const es = lang === 'es'

  if (!supported) return null

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl ${subscribed ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
          {subscribed
            ? <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            : <BellOff className="w-4 h-4 text-gray-400" />}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {subscribed
              ? (es ? 'Notificaciones activas' : 'Push notifications on')
              : (es ? 'Notificaciones desactivadas' : 'Push notifications off')}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {subscribed
              ? (es ? 'Las alertas llegan aunque la app esté cerrada' : 'Alerts will appear even when app is closed')
              : (es ? 'Recibe alertas sin abrir la app' : 'Get alerts without opening the app')}
          </p>
        </div>
      </div>
      <button
        onClick={subscribed ? unsubscribe : subscribe}
        disabled={loading}
        className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50 ${
          subscribed
            ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {loading ? '...' : subscribed ? (es ? 'Desactivar' : 'Turn off') : (es ? 'Activar' : 'Enable')}
      </button>
    </div>
  )
}
