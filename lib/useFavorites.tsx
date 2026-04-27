'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './useAuth'
import { fetchWithTimeout } from './fetchWithTimeout'

// Favorites context — wraps /api/saved with a single in-memory Set so any
// number of PortCards can read "is this starred?" synchronously after the
// first fetch. ONE provider mounts at app/layout, every consumer reads
// from context. Without the provider, useFavorites() returns the same
// shape but is inert (used to be how this hook ran per-instance, which
// caused a 3,503 req/5min spike on 2026-04-26 when 15+ PortCards each
// re-fetched on every Supabase auth event — see incident memo).

interface SavedRow {
  port_id: string
  label?: string | null
}

interface FavoritesContextValue {
  favorites: Set<string>
  isFavorite: (portId: string) => boolean
  toggleFavorite: (portId: string, label?: string) => Promise<{ ok: true } | { ok: false; reason: 'guest' | 'network' }>
  loading: boolean
  signedIn: boolean
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null)

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  // Stabilize on user.id (string) so we don't refetch on every Supabase
  // onAuthStateChange that returns a new User object reference.
  const userId = user?.id ?? null
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  // Latest userId held in a ref so the toggle callback can read it
  // without rebuilding (and forcing consumers to re-render).
  const userIdRef = useRef<string | null>(userId)
  userIdRef.current = userId

  useEffect(() => {
    if (authLoading) return
    if (!userId) {
      setFavorites(new Set())
      setLoading(false)
      return
    }
    let cancelled = false
    fetchWithTimeout('/api/saved', { cache: 'no-store' }, 5000)
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) {
          setFavorites(new Set())
          return
        }
        const json = await res.json()
        const ids = new Set<string>(
          (json.saved as SavedRow[] | undefined)?.map((r) => r.port_id) ?? []
        )
        setFavorites(ids)
      })
      .catch(() => {
        if (!cancelled) setFavorites(new Set())
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [authLoading, userId])

  const isFavorite = useCallback((portId: string) => favorites.has(portId), [favorites])

  const toggleFavorite = useCallback(
    async (portId: string, label?: string) => {
      if (!userIdRef.current) return { ok: false, reason: 'guest' as const }
      let currentlyFavorite = false
      setFavorites((prev) => {
        currentlyFavorite = prev.has(portId)
        const next = new Set(prev)
        if (currentlyFavorite) next.delete(portId)
        else next.add(portId)
        return next
      })
      try {
        const res = currentlyFavorite
          ? await fetch(`/api/saved?portId=${encodeURIComponent(portId)}`, { method: 'DELETE' })
          : await fetch('/api/saved', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ portId, label }),
            })
        if (!res.ok) throw new Error('save failed')
        return { ok: true as const }
      } catch {
        setFavorites((prev) => {
          const next = new Set(prev)
          if (currentlyFavorite) next.add(portId)
          else next.delete(portId)
          return next
        })
        return { ok: false, reason: 'network' as const }
      }
    },
    []
  )

  const value = useMemo<FavoritesContextValue>(
    () => ({ favorites, isFavorite, toggleFavorite, loading, signedIn: !!userId }),
    [favorites, isFavorite, toggleFavorite, loading, userId]
  )

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

const INERT: FavoritesContextValue = {
  favorites: new Set(),
  isFavorite: () => false,
  toggleFavorite: async () => ({ ok: false, reason: 'guest' }),
  loading: false,
  signedIn: false,
}

export function useFavorites(): FavoritesContextValue {
  return useContext(FavoritesContext) ?? INERT
}
