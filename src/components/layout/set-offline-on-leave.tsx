'use client'

import { useEffect } from 'react'

/**
 * When the user closes the tab, refreshes, or navigates away,
 * send a request to mark them offline so the social bar updates.
 */
export function SetOfflineOnLeave() {
  useEffect(() => {
    const handleLeave = () => {
      fetch('/api/status/offline', { method: 'POST', keepalive: true, credentials: 'same-origin' })
    }

    const handlePageHide = (e: PageTransitionEvent) => {
      if (!e.persisted) {
        handleLeave()
      }
    }

    window.addEventListener('pagehide', handlePageHide)
    return () => window.removeEventListener('pagehide', handlePageHide)
  }, [])

  return null
}
