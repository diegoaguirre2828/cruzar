'use client'

// Signature "report sent" animation.
//
// Three concentric rings radiate outward from a central checkmark, framing
// the submit as a signal broadcast to the community. Pure CSS (keyframes
// live in app/globals.css as cruzar-radar and cruzar-stamp). Shows for
// ~1.6s then settles into a static check.
//
// Used in both ReportForm and JustCrossedPrompt success states.

interface Props {
  /** Visual variant */
  variant?: 'broadcast' | 'stamp-only'
  /** Tailwind color class for the center check (default green-500) */
  accentClass?: string
}

export function ReportSentAnimation({ variant = 'broadcast', accentClass = 'bg-green-500' }: Props) {
  return (
    <div className="relative h-28 flex items-center justify-center select-none pointer-events-none">
      {variant === 'broadcast' && (
        <>
          {/* Three radar rings — staggered via nth-child delays in globals.css */}
          <span className="cruzar-radar-ring text-blue-500/80" />
          <span className="cruzar-radar-ring text-blue-500/80" />
          <span className="cruzar-radar-ring text-blue-500/80" />
        </>
      )}

      {/* Checkmark stamp */}
      <div
        className={`cruzar-stamp relative z-10 w-20 h-20 rounded-full ${accentClass} flex items-center justify-center shadow-xl`}
      >
        <svg
          className="w-10 h-10 text-white"
          fill="none"
          stroke="currentColor"
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path d="M5 13l4 4L19 7" />
        </svg>
      </div>
    </div>
  )
}
