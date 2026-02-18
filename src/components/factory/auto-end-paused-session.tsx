'use client'

import { useEffect, useRef } from 'react'
import { checkCurrentSession, punchOut } from '@/app/(factory)/actions'
import { toast } from 'sonner'

const DEFAULT_PAUSED_AUTO_END_MINUTES = 60
const isDev = typeof window !== 'undefined' && process.env.NODE_ENV === 'development'

// For local testing: use ?paused_auto_end_min=1 in the URL (dev only), or set NEXT_PUBLIC_PAUSED_AUTO_END_MINUTES=1 in .env.local and restart.
function getPausedAutoEndMinutes(): number {
  if (isDev && typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    const q = params.get('paused_auto_end_min')
    if (q != null && q !== '') {
      const n = parseInt(q, 10)
      if (!Number.isNaN(n) && n >= 1) return n
    }
  }
  const env = process.env.NEXT_PUBLIC_PAUSED_AUTO_END_MINUTES
  if (env == null || env === '') return DEFAULT_PAUSED_AUTO_END_MINUTES
  const n = parseInt(env, 10)
  return Number.isNaN(n) || n < 1 ? DEFAULT_PAUSED_AUTO_END_MINUTES : n
}

export function AutoEndPausedSession() {
  const didToastRef = useRef<string | null>(null)
  const thresholdMinutes = getPausedAutoEndMinutes()

  useEffect(() => {
    const check = async () => {
      const session = await checkCurrentSession()
      if (isDev) {
        console.debug('[AutoEndPaused] check', {
          hasSession: !!session,
          id: session?.id,
          status: session?.status,
          last_paused_at: session?.last_paused_at ?? null,
          thresholdMinutes,
        })
      }
      if (!session?.id) return
      if (session.status !== 'paused') return
      if (!session.last_paused_at) {
        if (isDev) console.debug('[AutoEndPaused] skip: no last_paused_at (pause the session again so it gets set)')
        return
      }

      const pausedAt = new Date(session.last_paused_at)
      const elapsedMs = Date.now() - pausedAt.getTime()
      const elapsedMinutes = elapsedMs / (1000 * 60)
      if (isDev) {
        console.debug('[AutoEndPaused] elapsed', { elapsedMinutes: Math.round(elapsedMinutes * 10) / 10, thresholdMinutes })
      }
      if (elapsedMinutes < thresholdMinutes) return

      if (isDev) console.debug('[AutoEndPaused] auto-ending session', session.id)
      const res = await punchOut(session.id)
      if (res?.success) {
        const toastId = `auto-end-paused-${session.id}`
        if (didToastRef.current !== toastId) {
          didToastRef.current = toastId
          const durationLabel =
            thresholdMinutes >= 60
              ? `${thresholdMinutes / 60} hour${thresholdMinutes > 60 ? 's' : ''}`
              : `${thresholdMinutes} minute${thresholdMinutes !== 1 ? 's' : ''}`
          toast(
            `Your session was automatically ended because it had been paused for more than ${durationLabel}.`,
            {
              duration: Infinity,
              id: toastId,
            }
          )
        }
        window.dispatchEvent(new Event('session-completed'))
      }
    }

    const run = () => {
      if (document.visibilityState === 'visible') check()
    }

    run()
    document.addEventListener('visibilitychange', run)
    // When threshold is 1 hr, poll every 5 min; when testing with short threshold (e.g. 1 min), poll every 15 sec
    const intervalMs = thresholdMinutes >= 60 ? 5 * 60 * 1000 : 15 * 1000
    const interval = setInterval(run, intervalMs)
    return () => {
      document.removeEventListener('visibilitychange', run)
      clearInterval(interval)
    }
  }, [thresholdMinutes])

  return null
}
