'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from './auth'

// 2026-04-14: Diego reported Google sign-in "stuck loading" on /welcome.
// Root cause was this hook: getUser() is a network call that can hang
// or reject (Supabase cold start, CORS hiccup, stale token), and the
// previous implementation had no .catch() and no timeout — so `loading`
// stayed true indefinitely and every page gating on authLoading showed
// a permanent spinner. Fix:
//   1. Bootstrap from the LOCAL session first (getSession, ~instant)
//      so `loading` is cleared even when the network is slow.
//   2. Always clear loading on any terminal branch (.catch, .then).
//   3. Hard 4s timeout — if nothing resolved by then, stop loading
//      and let pages render their signed-out state instead of hanging.
//   4. Keep onAuthStateChange as the live truth source after mount.

// Cache whether we had a session last time. This prevents the flash
// of guest UI ("create account") on every page load for logged-in users.
// The flag is set when we confirm a user, cleared on sign-out.
function wasLoggedIn(): boolean {
  if (typeof window === 'undefined') return false
  try { return localStorage.getItem('cruzar_has_session') === '1' } catch { return false }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  // If user was logged in last time, start with loading=true so guest
  // UI stays hidden until auth resolves. If never logged in, set
  // loading=false immediately so guest UI renders without delay.
  const [loading, setLoading] = useState(wasLoggedIn)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    // Hard ceiling — never leave the caller gated on authLoading longer
    // than 4 seconds, even if every async branch below gets stuck.
    const hardTimeout = setTimeout(() => {
      if (!cancelled) setLoading(false)
    }, 4000)

    // Fast path: session is cached in localStorage, returns synchronously
    // on most browsers. This is what clears `loading` in the common case.
    supabase.auth.getSession()
      .then(({ data }) => {
        if (cancelled) return
        const u = data.session?.user ?? null
        setUser(u)
        setLoading(false)
        try {
          if (u) localStorage.setItem('cruzar_has_session', '1')
          else localStorage.removeItem('cruzar_has_session')
        } catch {}
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    // Authoritative verification — validates the token against Supabase.
    // If it rejects we still want `loading` cleared so the UI can render.
    supabase.auth.getUser()
      .then(({ data }) => {
        if (cancelled) return
        setUser(data.user)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (cancelled) return
      const u = session?.user ?? null
      setUser(u)
      setLoading(false)
      try {
        if (u) localStorage.setItem('cruzar_has_session', '1')
        else localStorage.removeItem('cruzar_has_session')
      } catch {}
    })

    return () => {
      cancelled = true
      clearTimeout(hardTimeout)
      subscription.unsubscribe()
    }
  }, [])

  return { user, loading }
}
