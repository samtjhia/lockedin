'use client'

import { useEffect, useState } from 'react'
import { ActivityCalendar, type Activity } from 'react-activity-calendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getHeatmapData } from '@/app/actions/dashboard'
import { Tooltip as ReactTooltip } from 'react-tooltip'
import 'react-tooltip/dist/react-tooltip.css'

export function HeatMap() {
    const [data, setData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadData()
        window.addEventListener('session-completed', loadData)
        return () => window.removeEventListener('session-completed', loadData)
    }, [])

    async function loadData() {
        try {
            // @ts-ignore
            const res = await getHeatmapData()
            // console.log('Heatmap data:', res) // Reduced noise
            
            const filledData = fillDateGaps(res)
            setData(filledData)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    if (loading) return <div className="h-[200px] w-full animate-pulse bg-zinc-900 rounded-xl" />

    // Determine date range for the calendar to ensure it shows a full year
    const today = new Date()
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(today.getFullYear() - 1)

    return (
        <Card className="border-zinc-800 bg-zinc-950/50">
            <CardHeader>
                <CardTitle className="text-zinc-400">Activity Log</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="w-full overflow-x-auto pb-2">
                    <div className="min-w-[600px] w-full flex justify-center">
                        <ActivityCalendar
                            data={data}
                            theme={{
                                light: ['#18181b', '#0e4429', '#006d32', '#26a641', '#39d353'],
                                dark: ['#27272a', '#0e4429', '#006d32', '#26a641', '#39d353'], // GitHub dark green colors
                            }}
                            colorScheme="dark"
                            blockSize={12}
                            blockMargin={4}
                            fontSize={12}
                            maxLevel={4}
                            renderBlock={(block: any, activity: any) => (
                                 <div data-tooltip-id="react-tooltip" data-tooltip-content={`${activity.count} sessions on ${activity.date}`}>
                                    {block}
                                 </div>
                            )}
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
    const today = new Date()
    const end = new Date(today)
    const start = new Date(today)
    start.setFullYear(today.getFullYear() - 1)

    const map = new Map(data.map(d => [d.date, d]))
    const result = []

    for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0]
        if (map.has(dateStr)) {
            result.push(map.get(dateStr))
        } else {
            result.push({ date: dateStr, count: 0, level: 0 })
        }
    }
    return result
}
