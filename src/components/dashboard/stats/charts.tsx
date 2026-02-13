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

export function Charts({ initialMetrics }: ChartsProps) {
    const [metrics, setMetrics] = useState<any>(initialMetrics ?? null)

    const loadMetrics = () => {
        getDailyMetrics().then(data => setMetrics(data))
    }

    useEffect(() => {
        // Only fetch if no initial data provided
        if (!initialMetrics) loadMetrics()
        // Listen for session completion to refresh
        window.addEventListener('session-completed', loadMetrics)
        return () => window.removeEventListener('session-completed', loadMetrics)
    }, [initialMetrics])

    const { theme } = useTheme()

    if (!metrics) return null

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
                <CardContent className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
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
                </CardContent>
            </Card>

            {/* TOPIC DISTRIBUTION */}
            <Card className="border-border bg-muted/50">
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-muted-foreground">Topic Distribution</CardTitle>
                </CardHeader>
                <CardContent className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={topicData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={2} // Reduced padding to prevent small slices from disappearing
                                minAngle={2}     // Ensure small slices are always visible
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
                </CardContent>
            </Card>
        </div>
    )
}
