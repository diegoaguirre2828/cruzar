export default function DatosLoading() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto px-4 pb-24">
        <div className="pt-6 pb-2">
          <div className="h-6 w-44 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
          <div className="h-3 w-64 bg-gray-200 dark:bg-gray-800 rounded mt-2 animate-pulse" />
        </div>
        {/* Port picker skeleton */}
        <div className="mt-3 h-10 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
        {/* Hero card skeleton */}
        <div className="mt-4 h-28 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
        {/* Peak / best cards skeleton */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="h-20 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
          <div className="h-20 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
        </div>
        {/* Chart skeleton */}
        <div className="mt-3 h-44 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
      </div>
    </main>
  )
}
