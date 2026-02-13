'use client'

import { useEffect, useState, cloneElement, useRef } from 'react'
import { ActivityCalendar, type Activity } from 'react-activity-calendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getHeatmapData } from '@/app/actions/dashboard'
import { Tooltip as ReactTooltip } from 'react-tooltip'
import 'react-tooltip/dist/react-tooltip.css'

type HeatMapProps = {
    initialData?: any[]
}

function formatMinutes(mins: number): string {
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    const remaining = mins % 60
    return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`
}

function formatTotalTime(mins: number): string {
    const hours = Math.floor(mins / 60)
    const remaining = mins % 60
    if (hours === 0) return `${mins} minutes`
    return `${hours}h ${remaining}m`
}

export function HeatMap({ initialData }: HeatMapProps) {
    const [data, setData] = useState<any[]>(() => initialData ? fillDateGaps(initialData) : [])

    useEffect(() => {
        // Only fetch if no initial data
        if (!initialData) loadData()
        window.addEventListener('session-completed', loadData)
        return () => window.removeEventListener('session-completed', loadData)
    }, [initialData])

    async function loadData() {
        try {
            const res = await getHeatmapData()
            setData(fillDateGaps(res))
        } catch (e) {
            console.error(e)
        }
    }

    if (data.length === 0) return <div className="h-[200px] w-full animate-pulse bg-zinc-900 rounded-xl" />

    // Determine date range for the calendar to ensure it shows a full year
    const today = new Date()
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(today.getFullYear() - 1)
    
    const totalMinutes = data.reduce((acc, curr) => acc + curr.count, 0)

    return (
        <Card className="border-zinc-800 bg-zinc-950/50">
            <CardHeader>
                <CardTitle className="text-zinc-400">Activity Log ({formatTotalTime(totalMinutes)})</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="w-full overflow-x-auto pb-2 scrollbar-none" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    <div className="w-full flex justify-center">
                        <ActivityCalendar
                            data={data}
                            style={{ color: '#71717a' }}
                            theme={{
                                light: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
                                dark: ['#27272a', '#0e4429', '#006d32', '#26a641', '#39d353'],
                            }}
                            colorScheme="dark"
                            blockSize={9}
                            blockMargin={2}
                            blockRadius={1}
                            fontSize={11}
                            maxLevel={4}
                            renderBlock={(block: any, activity: any) => 
                                cloneElement(block, {
                                    'data-tooltip-id': 'react-tooltip',
                                    'data-tooltip-content': `${formatMinutes(activity.count)} on ${activity.date}`,
                                })
                            }
                            showWeekdayLabels
                        />
                    </div>
                    <ReactTooltip id="react-tooltip" />
                </div>
            </CardContent>
        </Card>
    )
}

function fillDateGaps(data: any[]) {
    // We want to show a fixed 1-year window ending "Today"
    const today = new Date()
    
    // Normalize today to local midnight to avoid time discrepancies
    today.setHours(0, 0, 0, 0)
    
    // Start 365 days ago
    const start = new Date(today)
    start.setDate(today.getDate() - 365)
    
    const map = new Map(data.map(d => [d.date, d]))
    const result = []

    // Loop day by day
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        const dateStr = `${year}-${month}-${day}`
        
        if (map.has(dateStr)) {
            result.push(map.get(dateStr))
        } else {
            result.push({ date: dateStr, count: 0, level: 0 })
        }
    }
    return result
}
