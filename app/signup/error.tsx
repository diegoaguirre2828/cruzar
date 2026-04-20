'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function SignupError({ error, reset }: Props) {
  useEffect(() => { Sentry.captureException(error) }, [error])

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 pt-10">
      <div className="max-w-md mx-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm text-center">
        <div className="text-3xl mb-2">✉️</div>
        <h1 className="text-base font-black text-gray-900 dark:text-gray-100 mb-1">
          Algo falló creando tu cuenta · Something failed creating your account
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug mb-4">
          Reintenta. Si sigue sin funcionar, escríbenos a hello@cruzar.app. · Try again. If it keeps failing, email us at hello@cruzar.app.
        </p>
        <div className="flex flex-col gap-2">
          <button onClick={reset} className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold active:scale-[0.98] transition-transform">
            Reintentar · Try again
          </button>
          <Link href="/" className="w-full py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-sm font-semibold">
            Inicio · Home
          </Link>
        </div>
        {error.digest && <p className="mt-3 text-[10px] text-gray-400 dark:text-gray-500 font-mono">ID: {error.digest}</p>}
      </div>
    </main>
  )
}
