import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60

  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function calculateGrade(seconds: number, period: 'daily' | 'weekly' = 'daily') {
  const hours = seconds / 3600
  
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

