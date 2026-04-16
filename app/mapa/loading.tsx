export default function MapaLoading() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto px-4 pb-24">
        <div className="pt-6 pb-3">
          <div className="h-6 w-48 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
          <div className="h-3 w-72 bg-gray-200 dark:bg-gray-800 rounded mt-2 animate-pulse" />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="mb-5">
            <div className="h-3 w-32 bg-gray-200 dark:bg-gray-800 rounded mb-2 animate-pulse" />
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {[0, 1, 2, 3].map((j) => (
                <div key={j} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                  <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 animate-pulse" />
                  <div className="flex-1">
                    <div className="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded mt-1 animate-pulse" />
                  </div>
                  <div className="h-4 w-14 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
