export default function LeaderboardLoading() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto px-4 pb-24">
        <div className="pt-6 pb-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
          <div>
            <div className="h-6 w-48 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
            <div className="h-3 w-56 bg-gray-200 dark:bg-gray-800 rounded mt-1 animate-pulse" />
          </div>
        </div>
        {/* Tier ladder skeleton */}
        <div className="h-40 bg-gray-200 dark:bg-gray-800 rounded-2xl mb-4 animate-pulse" />
        {/* Badge skeleton */}
        <div className="h-28 bg-gray-200 dark:bg-gray-800 rounded-2xl mb-4 animate-pulse" />
        {/* Leaderboard list skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
              <div className="flex-1">
                <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded mt-1 animate-pulse" />
              </div>
              <div className="h-6 w-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
