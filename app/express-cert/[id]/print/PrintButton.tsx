'use client'

interface Props { id: string }

export function PrintButton({ id }: Props) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => window.print()}
        className="px-3 py-2 rounded-xl bg-white border border-blue-300 text-blue-700 text-sm font-bold hover:bg-blue-50"
      >
        Print
      </button>
      <a
        href={`/api/express-cert/${id}/pdf`}
        className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700"
      >
        Download PDF
      </a>
    </div>
  )
}
