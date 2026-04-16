export default function HomeLoading() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto px-4 pb-24">
        {/* NavBar skeleton */}
        <div className="pt-4 pb-2 flex items-center justify-between">
          <div className="h-7 w-24 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
          <div className="flex gap-2">
            <div className="h-8 w-8 bg-gray-200 dark:bg-gray-800 rounded-full animate-pulse" />
            <div className="h-8 w-8 bg-gray-200 dark:bg-gray-800 rounded-full animate-pulse" />
          </div>
        </div>
        {/* Hero skeleton */}
        <div className="mt-3 h-28 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
        {/* Port cards skeleton */}
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="mt-3 h-24 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
        ))}
      </div>
    </main>
  )
}
