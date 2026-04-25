'use client'

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold"
    >
      Print / Save as PDF
    </button>
  )
}
