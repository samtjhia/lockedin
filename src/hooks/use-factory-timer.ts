'use client'

import { useState, useEffect, useRef } from 'react'
import { differenceInSeconds } from 'date-fns'

export function useFactoryTimer(startTimeISO: string | null) {
  const [seconds, setSeconds] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // If no start time, reset timer
    if (!startTimeISO) {
      setSeconds(0)
      setIsRunning(false)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      return
    }

    // Initialize timer based on elapsed time from server
    const calculateTime = () => {
      const start = new Date(startTimeISO)
      const now = new Date()
      // Ensure we don't show negative time if clocks are slightly off
      const diff = Math.max(0, differenceInSeconds(now, start))
      setSeconds(diff)
    }

    calculateTime() // Initial calc
    setIsRunning(true)

    // Tick every second to re-sync with wall clock
    intervalRef.current = setInterval(() => {
        calculateTime()
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [startTimeISO])

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
    isRunning
  }
}
