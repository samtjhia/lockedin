'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { getDailyMetrics } from '@/app/actions/dashboard'
import { formatDuration } from '@/lib/utils'
import { useTheme } from '@/components/theme/theme-provider'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']

type ChartsProps = {
    initialMetrics?: any
}

const CHART_HEIGHT = 250
const CHART_MIN_WIDTH = 280

export function Charts({ initialMetrics }: ChartsProps) {
    const [metrics, setMetrics] = useState<any>(initialMetrics ?? null)
    const [mounted, setMounted] = useState(false)
    const [canRenderCharts, setCanRenderCharts] = useState(false)

    const loadMetrics = () => {
        getDailyMetrics().then(data => setMetrics(data))
    }

    useEffect(() => {
        setMounted(true)
        // Only render Recharts when we have a valid container size (avoids -1 dimension errors on mobile)
        const check = () => setCanRenderCharts(typeof window !== 'undefined' && window.innerWidth >= 400)
        check()
        window.addEventListener('resize', check)
        return () => window.removeEventListener('resize', check)
    }, [])

    useEffect(() => {
        // Only fetch if no initial data provided
        if (!initialMetrics) loadMetrics()
        // Listen for session completion to refresh
        window.addEventListener('session-completed', loadMetrics)
        return () => window.removeEventListener('session-completed', loadMetrics)
    }, [initialMetrics])

    const { theme } = useTheme()

    if (!metrics || !mounted) return null

    // Avoid Recharts on very small viewports to prevent dimension errors
    if (!canRenderCharts) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-border bg-muted/50">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">Hourly Focus</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
                        Charts need a wider screen
                    </CardContent>
                </Card>
                <Card className="border-border bg-muted/50">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">Topic Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
                        Charts need a wider screen
                    </CardContent>
                </Card>
            </div>
        )
    }

    const axisColor = theme === 'dark' ? '#71717a' : '#a1a1aa'
    const tooltipBg = theme === 'dark' ? '#18181b' : '#ffffff'
    const tooltipBorder = theme === 'dark' ? '#27272a' : '#e4e4e7'
    const tooltipText = theme === 'dark' ? '#f4f4f5' : '#18181b'
    const cursorFill = theme === 'dark' ? '#27272a' : '#f4f4f5'

    const hourlyData = (metrics.hourly || []).map((h: any) => {
        // Create a date object for today and set the hour
        const date = new Date();
        date.setHours(h.hour, 0, 0, 0);
        
        // Format as 12-hour time (e.g., "2 PM")
        const label = date.toLocaleTimeString([], { hour: 'numeric', hour12: true });
        
        return {
            name: label,
            originalHour: h.hour,
            minutes: Number(h.minutes)
        };
    });
    // Note: If sorting is needed based on local time, we might need a more complex sort, 
    // but typically daily metrics coming from 0-23 UTC should be sorted by time.

    const topicData = (metrics.topics || [])
        .map((t: any) => ({
            name: t.topic,
            value: Number(t.total_minutes)
        }))
        // Filter out strict zeroes, but keep small values
        .filter((t: any) => t.value > 0);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* HOURLY FOCUS */}
            <Card className="border-border bg-muted/50">
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-muted-foreground">Hourly Focus (Minutes)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div
                        className="w-full"
                        style={{ minWidth: CHART_MIN_WIDTH, height: CHART_HEIGHT }}
                    >
                        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                            <BarChart data={hourlyData}>
                                <XAxis 
                                    dataKey="name" 
                                    tick={{ fill: axisColor, fontSize: 12 }} 
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis 
                                    hide={false}
                                    tick={{ fill: axisColor, fontSize: 12 }} 
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, color: tooltipText }}
                                    itemStyle={{ color: tooltipText }}
                                    labelStyle={{ color: tooltipText }}
                                    cursor={{ fill: cursorFill }}
                                    formatter={(value: number | undefined) => [formatDuration((value || 0) * 60), 'Focus Time']}
                                />
                                <Bar dataKey="minutes" fill="#34d399" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* TOPIC DISTRIBUTION */}
            <Card className="border-border bg-muted/50">
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-muted-foreground">Topic Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                    <div
                        className="w-full"
                        style={{ minWidth: CHART_MIN_WIDTH, height: CHART_HEIGHT }}
                    >
                        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                            <PieChart>
                                <Pie
                                    data={topicData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={2}
                                    minAngle={2}
                                    dataKey="value"
                                >
                                    {topicData.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0)" />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, color: tooltipText }} 
                                    itemStyle={{ color: tooltipText }}
                                    formatter={(value: number | undefined) => [formatDuration((value || 0) * 60), 'Duration']}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
