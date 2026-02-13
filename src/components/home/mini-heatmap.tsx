'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'

type HeatmapData = {
  date: string
  count: number
  level: number
}

type MiniHeatmapProps = {
  data: HeatmapData[]
  weeks?: number // How many weeks to show (default 52 for full year)
  className?: string
}

export function MiniHeatmap({ data, weeks = 52, className }: MiniHeatmapProps) {
  // Organize data into a proper grid: 7 rows (days of week), N columns (weeks)
  // Most recent day should be at the bottom-right
  const { grid, totalMinutes } = useMemo(() => {
    const map = new Map(data.map(d => [d.date, d]))
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayDayOfWeek = today.getDay() // 0 = Sunday
    
    // Find the most recent Saturday (end of week) - this will be the last column's end
    // If today is Saturday, use today. Otherwise, find the upcoming Saturday.
    const endOfCurrentWeek = new Date(today)
    const daysUntilSaturday = (6 - todayDayOfWeek + 7) % 7
    endOfCurrentWeek.setDate(today.getDate() + daysUntilSaturday)
    
    // Calculate the start date (beginning of first week to show)
    const startDate = new Date(endOfCurrentWeek)
    startDate.setDate(endOfCurrentWeek.getDate() - (weeks * 7) + 1)
    
    // Build grid: 7 rows (Sun=0 to Sat=6), each with `weeks` columns
    const grid: (HeatmapData | null)[][] = Array.from({ length: 7 }, () => 
      Array.from({ length: weeks }, () => null)
    )
    
    // Fill in the grid
    for (let weekIndex = 0; weekIndex < weeks; weekIndex++) {
      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        const dayOffset = weekIndex * 7 + dayOfWeek
        const cellDate = new Date(startDate)
        cellDate.setDate(startDate.getDate() + dayOffset)
        
        // Skip future dates
        if (cellDate > today) {
          grid[dayOfWeek][weekIndex] = null
          continue
        }
        
        const dateStr = cellDate.toISOString().split('T')[0]
        
        if (map.has(dateStr)) {
          grid[dayOfWeek][weekIndex] = map.get(dateStr)!
        } else {
          grid[dayOfWeek][weekIndex] = { date: dateStr, count: 0, level: 0 }
        }
      }
    }
    
    const totalMinutes = data.reduce((acc, d) => acc + Number(d.count), 0)
    
    return { grid, totalMinutes }
  }, [data, weeks])

  const formatMinutes = (mins: number) => {
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    const remaining = mins % 60
    return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`
  }

  const formatTotalTime = (mins: number) => {
    const hours = Math.floor(mins / 60)
    if (hours === 0) return `${mins} min`
    return `${hours}h ${mins % 60}m total`
  }

  const getLevelColor = (level: number) => {
    switch (level) {
      case 0: return 'bg-zinc-800/50'
      case 1: return 'bg-green-900/60'
      case 2: return 'bg-green-700/70'
      case 3: return 'bg-green-500/80'
      case 4: return 'bg-green-400'
      default: return 'bg-zinc-800/50'
    }
  }

  return (
    <div className={cn("flex flex-col items-end gap-1", className)}>
      <div className="flex flex-col gap-[2px]">
        {grid.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-[2px]">
            {row.map((d, colIndex) => (
              <div
                key={d?.date ?? `empty-${rowIndex}-${colIndex}`}
                className={cn(
                  "w-[6px] h-[6px] rounded-[1px]",
                  d ? getLevelColor(d.level) : 'bg-transparent'
                )}
                title={d ? `${d.date}: ${formatMinutes(d.count)}` : undefined}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="text-[10px] text-zinc-500 font-mono">
        {formatTotalTime(totalMinutes)}
      </div>
    </div>
  )
}
