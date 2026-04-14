'use client'

import { useEffect, useState } from 'react'

// Lightweight client-side nudge registry. Each nudge is identified by
// a stable string key; once a user dismisses or "takes the action"
// associated with a nudge, we remember it in localStorage so they
// don't get hit with the same prompt on every page load.
//
// This is the D half of Diego's approved feature-discovery work —
// contextual rediscovery for users who haven't used a feature yet.
// Example nudges:
//   - User just saved a bridge → "did you know you can set an alert?"
//   - User just submitted a first report → "you're on the Guardian leaderboard"
//   - User opened /mas 3+ times but never tapped /features → "see everything"
//   - User is signed in but doesn't have the PWA installed → gentle install prompt
//
// Design rules:
//   1. Each nudge fires AT MOST ONCE per user per device
//   2. Dismissal is sticky — X button writes a permanent flag
//   3. "Took action" is also sticky — clicking the CTA marks it done
//   4. Nudges never block content — they're passive cards/toasts
//
// For server-side persistence across devices, add a profiles.nudges
// JSONB column later. localStorage is fine for now since the pain
// being solved (nagging returning users) is device-local anyway.

const NUDGE_KEY_PREFIX = 'cruzar_nudge_'

// 'inactive' = hasn't been armed yet (default for new users)
// 'pending'  = armed, user hasn't seen it yet
// 'seen'     = user has seen it at least once
// 'dismissed' = user explicitly X'd it — never show again
// 'taken'     = user clicked the CTA — never show again
export type NudgeState = 'inactive' | 'pending' | 'seen' | 'dismissed' | 'taken'

function readNudge(key: string): NudgeState {
  if (typeof window === 'undefined') return 'inactive'
  try {
    const v = localStorage.getItem(NUDGE_KEY_PREFIX + key)
    if (v === 'pending' || v === 'seen' || v === 'dismissed' || v === 'taken') return v
  } catch { /* ignore */ }
  // Default: nudge not yet armed. Nothing should render.
  return 'inactive'
}

function writeNudge(key: string, state: NudgeState): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(NUDGE_KEY_PREFIX + key, state)
  } catch { /* ignore */ }
}

export function useNudge(key: string) {
  const [state, setState] = useState<NudgeState>('inactive')

  useEffect(() => {
    setState(readNudge(key))
    // Re-read on storage events so a call to armNudge() from another
    // component instance flips this hook's state without a remount.
    const onStorage = (e: StorageEvent) => {
      if (e.key === NUDGE_KEY_PREFIX + key) setState(readNudge(key))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [key])

  const dismiss = () => {
    writeNudge(key, 'dismissed')
    setState('dismissed')
  }
  const markTaken = () => {
    writeNudge(key, 'taken')
    setState('taken')
  }
  const markSeen = () => {
    // Only upgrade pending → seen; once a user has dismissed or taken
    // action we don't overwrite.
    if (state === 'pending') {
      writeNudge(key, 'seen')
      setState('seen')
    }
  }

  return {
    state,
    isActive: state === 'pending' || state === 'seen',
    dismiss,
    markTaken,
    markSeen,
  }
}

// Arm a nudge imperatively — call when some trigger condition is
// met (e.g. user just saved their first bridge). Upgrades an
// 'inactive' nudge to 'pending' so it starts rendering. Won't
// override 'dismissed' or 'taken' — once the user has acted on a
// nudge, their choice sticks.
export function armNudge(key: string): void {
  if (typeof window === 'undefined') return
  try {
    const existing = localStorage.getItem(NUDGE_KEY_PREFIX + key)
    if (existing === 'dismissed' || existing === 'taken' || existing === 'seen' || existing === 'pending') return
    localStorage.setItem(NUDGE_KEY_PREFIX + key, 'pending')
    // Storage events don't fire in the same document that set the
    // item, so fire a custom event for in-tab listeners.
    window.dispatchEvent(new StorageEvent('storage', { key: NUDGE_KEY_PREFIX + key }))
  } catch { /* ignore */ }
}
