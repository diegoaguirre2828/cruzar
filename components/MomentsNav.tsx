'use client'

// Cross-page "moments" navigation — consumer crossing journey only.
// Two moments now: /live (during, ahorita) and /memory (after, después).
//
// /insights used to be the "before" slot but it's the B2B sales surface
// (different audience entirely — RGV freight brokers, not commuters).
// B2B has its own nav (components/B2BNav.tsx). Per the 2026-05-01
// stress-reliever redesign — see docs/superpowers/specs/2026-05-01-cruzar-b2b-stress-reliever-design.md.

import Link from 'next/link'
import { useLang } from '@/lib/LangContext'
import { Eye, Clock } from 'lucide-react'

type Moment = 'before' | 'during' | 'after'

interface Props {
  current: Moment
}

const MOMENTS: { key: Moment; href: string; icon: typeof Eye; label: { en: string; es: string }; sub: { en: string; es: string } }[] = [
  {
    key: 'during',
    href: '/live',
    icon: Eye,
    label: { en: 'During', es: 'Ahorita' },
    sub: { en: 'Live state', es: 'En vivo' },
  },
  {
    key: 'after',
    href: '/memory',
    icon: Clock,
    label: { en: 'After', es: 'Después' },
    sub: { en: 'Your memory', es: 'Tu memoria' },
  },
]

export function MomentsNav({ current }: Props) {
  const { lang } = useLang()
  return (
    <nav
      aria-label={lang === 'es' ? 'Momentos del cruce' : 'Crossing moments'}
      className="sticky top-0 z-30 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur border-b border-gray-200 dark:border-gray-800"
    >
      <div className="max-w-4xl mx-auto px-3">
        <div className="flex items-stretch text-[11px] gap-1 py-2">
          {MOMENTS.map((m) => {
            const Icon = m.icon
            const active = m.key === current
            return (
              <Link
                key={m.key}
                href={m.href}
                aria-current={active ? 'page' : undefined}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors ${
                  active
                    ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 font-bold'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="font-bold">{m.label[lang]}</span>
                <span className={`hidden sm:inline ${active ? 'text-white/70 dark:text-gray-700' : 'text-gray-400 dark:text-gray-500'}`}>
                  · {m.sub[lang]}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
