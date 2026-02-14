'use client'

import { useState, useEffect, useRef } from 'react'
import { differenceInSeconds } from 'date-fns'

export type PomoConfig = {
  sessionMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
}

const DEFAULT_POMO: PomoConfig = {
  sessionMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
}

export function useFactoryTimer(
    status: string = 'active',
    lastResumedAt: string | null,
    accumulatedSeconds: number = 0,
    mode: string = 'stopwatch',
    pomoConfig?: PomoConfig | null
) {
  const [seconds, setSeconds] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [isFinished, setIsFinished] = useState(false) // For Pomo/Break completion
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const config = pomoConfig ?? DEFAULT_POMO

  useEffect(() => {
    // Logic:
    // If paused, time is just accumulated.
    // If active, time is accumulated + (now - lastResumedAt)

    const calculateTime = () => {
      let elapsed = accumulatedSeconds

      if (status === 'active' && lastResumedAt) {
          const start = new Date(lastResumedAt)
          const now = new Date()
          elapsed += Math.max(0, differenceInSeconds(now, start))
      }

      // Determine display time based on mode (custom durations from pomoConfig)
      let displaySeconds = elapsed
      let finished = false

      if (mode === 'pomo') {
        const target = config.sessionMinutes * 60
        const remaining = Math.max(0, target - elapsed)
        displaySeconds = remaining
        if (remaining === 0) finished = true
      } else if (mode === 'short-break') {
        const target = config.shortBreakMinutes * 60
        const remaining = Math.max(0, target - elapsed)
        displaySeconds = remaining
        if (remaining === 0) finished = true
      } else if (mode === 'long-break') {
        const target = config.longBreakMinutes * 60
        const remaining = Math.max(0, target - elapsed)
        displaySeconds = remaining
        if (remaining === 0) finished = true
      }

      setSeconds(displaySeconds)
      setIsFinished(finished)
    }

    calculateTime() // Initial

    if (status === 'active') {
        setIsRunning(true)
        intervalRef.current = setInterval(calculateTime, 1000)
    } else {
        setIsRunning(false)
        if (intervalRef.current) clearInterval(intervalRef.current)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [status, lastResumedAt, accumulatedSeconds, mode, config.sessionMinutes, config.shortBreakMinutes, config.longBreakMinutes])

  // Helper to format MM:SS or HH:MM:SS
  const formattedTime = (() => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  })()

  return {
    seconds,
    formattedTime,
    isRunning,
    isFinished
  }
}
