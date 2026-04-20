'use client'

import { useState, useEffect } from 'react'

export function usePushNotifications() {
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    // On iOS, Web Push only works when the site is installed as a PWA
    // via "Add to Home Screen" — prompting inside a Safari tab silently
    // fails and burns the user's ability to opt in later. Gate support
    // on standalone display-mode so the in-app alert prompt + any other
    // caller of this hook skip the prompt until the user installs.
    const ua = navigator.userAgent
    const isIos = /iPhone|iPad|iPod/.test(ua)
    if (isIos) {
      type IosNav = Navigator & { standalone?: boolean }
      const standalone =
        (navigator as IosNav).standalone === true ||
        (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches)
      if (!standalone) return
    }

    setSupported(true)
    navigator.serviceWorker.register('/sw.js').then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        setSubscribed(!!sub)
      })
    })
  }, [])

  async function subscribe() {
    setLoading(true)
    try {
      // Ensure permission is granted (will prompt the user if default)
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        const result = await Notification.requestPermission()
        if (result !== 'granted') {
          setLoading(false)
          return
        }
      }
      if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
        setLoading(false)
        return
      }

      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        // Make sure the server has this endpoint recorded (it may have
        // been created before the user was logged in)
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(existing),
        }).catch(() => {})
        setSubscribed(true); setLoading(false); return
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) throw new Error('VAPID key not configured')

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as ArrayBuffer,
      })

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      })

      setSubscribed(true)
    } catch (err) {
      console.error('Push subscribe error:', err)
    }
    setLoading(false)
  }

  async function unsubscribe() {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        await fetch('/api/push/subscribe', { method: 'DELETE' })
      }
      setSubscribed(false)
    } catch (err) {
      console.error('Push unsubscribe error:', err)
    }
    setLoading(false)
  }

  return { supported, subscribed, loading, subscribe, unsubscribe }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}
