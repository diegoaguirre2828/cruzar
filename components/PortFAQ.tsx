'use client'

import { useState } from 'react'
import { ChevronDown, HelpCircle } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import { getCityFAQs, getPortFAQs, type FAQEntry } from '@/lib/faqContent'

// Reusable FAQ accordion with Schema.org FAQPage JSON-LD.
//
// Two modes:
//   - <PortFAQ />            renders the 10 shared FAQ entries (used on /port/[id])
//   - <PortFAQ citySlug="tijuana" />  renders city-specific questions +
//                            the 10 shared entries (used on /city/[slug])
//
// The JSON-LD script tag emits FAQPage markup that Google parses for
// the "People also ask" rich result. This is the highest-ROI SEO
// steal from bordergarita.com — see
// memory/project_cruzar_competitor_bordergarita.md for rationale.
//
// Voice rules per feedback_cruzar_fb_reply_voice.md: answers are
// casual RGV Spanish (with English translations), no emojis inside
// the content, short enough for Google to parse cleanly.

interface Props {
  citySlug?: string
}

export function PortFAQ({ citySlug }: Props) {
  const { lang } = useLang()
  const es = lang === 'es'
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  const faqs: FAQEntry[] = citySlug ? getCityFAQs(citySlug) : getPortFAQs()

  // Schema.org FAQPage JSON-LD. Always emits the Spanish answers
  // since the site's target audience is Spanish-first and Google
  // picks up hreflang automatically from the page's lang attribute.
  // We also inject English as alternate on bilingual queries.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: es ? faq.q.es : faq.q.en,
      acceptedAnswer: {
        '@type': 'Answer',
        text: es ? faq.a.es : faq.a.en,
      },
    })),
  }

  return (
    <section
      className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm"
      aria-labelledby="port-faq-heading"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="flex items-center gap-2 mb-4">
        <HelpCircle className="w-5 h-5 text-blue-500" />
        <h2
          id="port-faq-heading"
          className="text-base font-bold text-gray-900 dark:text-white"
        >
          {es ? 'Preguntas frecuentes' : 'Frequently asked questions'}
        </h2>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {faqs.map((faq, i) => {
          const isOpen = openIdx === i
          return (
            <div key={i} className="py-3 first:pt-0 last:pb-0">
              <button
                type="button"
                onClick={() => setOpenIdx(isOpen ? null : i)}
                className="w-full flex items-start justify-between gap-3 text-left"
                aria-expanded={isOpen}
              >
                <span className="text-sm font-semibold text-gray-900 dark:text-white leading-snug flex-1">
                  {es ? faq.q.es : faq.q.en}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5 transition-transform ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {isOpen && (
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mt-2 pr-7">
                  {es ? faq.a.es : faq.a.en}
                </p>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-4 leading-snug">
        {es
          ? 'La información anterior es una guía general. Las políticas de CBP cambian — verifica con fuentes oficiales antes de viajar.'
          : 'The above information is a general guide. CBP policies change — verify with official sources before you travel.'}
      </p>
    </section>
  )
}
