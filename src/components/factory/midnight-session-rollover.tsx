'use client'

import { useEffect, useRef } from 'react'
import {
  checkCurrentSession,
  endSessionAt,
  getStartOfTodayTorontoISOAction,
  punchIn,
} from '@/app/(factory)/actions'
import { toast } from 'sonner'

const TORONTO_TZ = 'America/Toronto'
/** When in the midnight window (23:45–00:05 Toronto), check this often. */
const ROLLOVER_CHECK_INTERVAL_MS = 60 * 1000
const ROLLOVER_TEST_INTERVAL_MS = 5 * 1000
/** When outside the midnight window, only check whether we've entered the window (no session/date work). */
const OUTSIDE_WINDOW_CHECK_MS = 5 * 60 * 1000
/** Midnight window: from 23:45 to 00:05 Toronto (start checking 15 min before, stop 5 min after). */
const MIDNIGHT_WINDOW_START = { hour: 23, minute: 45 }
const MIDNIGHT_WINDOW_END = { hour: 0, minute: 5 }
/** In test mode, we skip rolling over the session we just created (by id), not by age. */
const isDev = typeof window !== 'undefined' && process.env.NODE_ENV === 'development'

function log(...args: unknown[]) {
  if (isDev) console.log('[MidnightRollover]', ...args)
}

function getTorontoTime(): { hours: number; minutes: number } {
  const now = new Date()
  const hours = parseInt(
    now.toLocaleString('en-CA', { timeZone: TORONTO_TZ, hour: '2-digit', hour12: false }),
    10
  )
  const minutes = parseInt(
    now.toLocaleString('en-CA', { timeZone: TORONTO_TZ, minute: '2-digit' }),
    10
  )
  return { hours, minutes }
}

/** True when we're in the 23:45–00:05 Toronto window (nearing or just past midnight). */
function isInMidnightWindow(): boolean {
  const { hours, minutes } = getTorontoTime()
  if (hours === MIDNIGHT_WINDOW_START.hour && minutes >= MIDNIGHT_WINDOW_START.minute) return true
  if (hours === MIDNIGHT_WINDOW_END.hour && minutes <= MIDNIGHT_WINDOW_END.minute) return true
  return false
}

/** Dev only: test mode is ON only when URL has ?midnight_rollover_test=1 (so regular page never triggers rollover). */
function isMidnightRolloverTestMode(): boolean {
  if (!isDev) return false
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('midnight_rollover_test') === '1'
}

export function MidnightSessionRollover() {
  const lastRolloverSessionIdRef = useRef<string | null>(null)
  const testModeCreatedSessionIdRef = useRef<string | null>(null)

  useEffect(() => {
    const run = async () => {
      if (document.visibilityState !== 'visible') return

      const session = await checkCurrentSession()
      const testMode = isMidnightRolloverTestMode()
      log('check', {
        visible: document.visibilityState === 'visible',
        hasSession: !!session,
        sessionId: session?.id,
        status: session?.status,
        started_at: session?.started_at,
        testMode,
      })
      if (!session?.id || (session.status !== 'active' && session.status !== 'paused')) return

      if (testMode && session.id === testModeCreatedSessionIdRef.current) {
        log('skip: session was just created by rollover (test mode)', session.id)
        return
      }

      const todayToronto = testMode
        ? new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', {
            timeZone: TORONTO_TZ,
          })
        : new Date().toLocaleDateString('en-CA', { timeZone: TORONTO_TZ })
      const realSessionStartDateToronto = new Date(session.started_at).toLocaleDateString('en-CA', {
        timeZone: TORONTO_TZ,
      })
      const sessionStartDateToronto = realSessionStartDateToronto
      log('dates', {
        todayToronto,
        sessionStartDateToronto: realSessionStartDateToronto,
        sessionStartDateTorontoUsed: sessionStartDateToronto,
        testModeTodayIsTomorrow: testMode,
        willRollover: sessionStartDateToronto < todayToronto,
      })
      if (sessionStartDateToronto >= todayToronto) {
        log('skip: session started today (no rollover needed)')
        return
      }

      if (lastRolloverSessionIdRef.current === session.id) {
        log('skip: already rolled over this session', session.id)
        return
      }

      log('midnight cross detected, ending session', session.id)
      const midnightISO = testMode
        ? new Date().toISOString()
        : await getStartOfTodayTorontoISOAction()
      if (testMode) log('test mode: using now as end time', midnightISO)
      const endResult = await endSessionAt(session.id, midnightISO)
      log('endSessionAt', {
        midnightISO,
        success: endResult?.success,
        error: endResult && 'error' in endResult ? endResult.error : undefined,
      })
      if (!endResult?.success || !endResult.session) {
        log('endSessionAt failed or no session in response, will retry next tick')
        return
      }

      if (session.status === 'active') {
        const formData = new FormData()
        formData.append('taskName', session.task_name ?? 'Focus')
        formData.append('mode', session.mode ?? 'stopwatch')
        formData.append('isAuto', 'true')
        const punchResult = await punchIn(formData)
        const newSession = punchResult?.session
        log('punchIn after rollover', {
          success: punchResult?.success,
          newSessionId: newSession?.id,
          error: punchResult && 'error' in punchResult ? punchResult.error : undefined,
        })

        toast(
          'Since it hit midnight, to avoid confusion the app auto-ended your active session and auto-started a new one for today.',
          { duration: Infinity, id: `midnight-rollover-active-${session.id}` }
        )
        window.dispatchEvent(new Event('session-completed'))
        if (newSession) {
          if (testMode) testModeCreatedSessionIdRef.current = newSession.id
          window.dispatchEvent(
            new CustomEvent('session-rolled-over', { detail: { session: newSession } })
          )
        }
      } else {
        log('paused rollover complete, dispatching session-completed')
        toast(
          'Since it hit midnight, your paused session was auto-ended to avoid confusion.',
          { duration: Infinity, id: `midnight-rollover-paused-${session.id}` }
        )
        window.dispatchEvent(new Event('session-completed'))
      }

      lastRolloverSessionIdRef.current = session.id
    }

    const testMode = isMidnightRolloverTestMode()

    if (testMode) {
      const intervalMs = ROLLOVER_TEST_INTERVAL_MS
      if (isDev) console.log('[MidnightRollover] mounted (test mode)', { intervalSec: intervalMs / 1000 })
      const tick = () => run()
      tick()
      document.addEventListener('visibilitychange', tick)
      const interval = setInterval(tick, intervalMs)
      return () => {
        document.removeEventListener('visibilitychange', tick)
        clearInterval(interval)
      }
    }

    // Production: only run the full check when in the midnight window (23:45–00:05 Toronto)
    let timeoutId: ReturnType<typeof setTimeout>
    const schedule = () => {
      const inWindow = isInMidnightWindow()
      const delayMs = inWindow ? ROLLOVER_CHECK_INTERVAL_MS : OUTSIDE_WINDOW_CHECK_MS
      timeoutId = setTimeout(async () => {
        if (document.visibilityState !== 'visible') {
          schedule()
          return
        }
        if (isInMidnightWindow()) await run()
        schedule()
      }, delayMs)
    }

    if (isDev) {
      console.log('[MidnightRollover] mounted', {
        midnightWindow: '23:45–00:05 Toronto',
        checkEverySecWhenInWindow: ROLLOVER_CHECK_INTERVAL_MS / 1000,
        checkEveryMinWhenOutside: OUTSIDE_WINDOW_CHECK_MS / 60000,
      })
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && isInMidnightWindow()) run()
      schedule()
    }
    if (document.visibilityState === 'visible' && isInMidnightWindow()) run()
    schedule()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      clearTimeout(timeoutId)
    }
  }, [])

  return null
}
