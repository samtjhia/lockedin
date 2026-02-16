import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number) {
  const roundedSeconds = Math.round(seconds)
  const h = Math.floor(roundedSeconds / 3600)
  const m = Math.floor((roundedSeconds % 3600) / 60)
  const s = roundedSeconds % 60

  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function calculateGrade(seconds: number, period: 'daily' | 'weekly' | 'monthly' = 'daily') {
  const hours = seconds / 3600
  
  if (period === 'monthly') {
    if (hours >= 100) return 'S'
    if (hours >= 80) return 'A'
    if (hours >= 60) return 'B'
    if (hours >= 40) return 'C'
    if (hours >= 20) return 'D'
    return 'F'
  }
  
  if (period === 'weekly') {
    if (hours >= 30) return 'S'
    if (hours >= 20) return 'A'
    if (hours >= 15) return 'B'
    if (hours >= 10) return 'C'
    if (hours >= 5) return 'D'
    return 'F'
  }

  // Daily Scale (Casual)
  if (hours >= 6) return 'S'
  if (hours >= 4) return 'A'
  if (hours >= 3) return 'B'
  if (hours >= 2) return 'C'
  if (hours >= 1) return 'D'
  return 'F'
}

/** Consider status stale (treat as offline) after this many ms without updated_at. */
export const STATUS_STALE_MS = 3 * 60 * 1000 // 3 minutes

/** Returns display status; treats non-offline status as offline if updatedAt is older than STATUS_STALE_MS. Only applies when no session is active (i.e. not active/paused). */
export function effectiveStatus(status: string | null, updatedAt: string | null): string {
  if (!status || status === 'offline') return status || 'offline'
  // Don't treat as stale when a session is active — user may be focused and not touching the app
  if (status === 'active' || status === 'paused') return status
  if (!updatedAt) return status
  const age = Date.now() - new Date(updatedAt).getTime()
  if (age > STATUS_STALE_MS) return 'offline'
  return status
}

