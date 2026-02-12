'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { getDailyMetrics } from '@/app/actions/dashboard'
import { Loader2 } from 'lucide-react'
import { formatDuration } from '@/lib/utils'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']

export function Charts() {
    const [metrics, setMetrics] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    const loadMetrics = () => {
        getDailyMetrics().then(data => {
            setMetrics(data)
            setLoading(false)
        })
    }

    useEffect(() => {
        loadMetrics()
        // Listen for session completion
        window.addEventListener('session-completed', loadMetrics)
        return () => window.removeEventListener('session-completed', loadMetrics)
    }, [])

    if (loading) return <div className="h-[300px] flex items-center justify-center"><Loader2 className="animate-spin text-zinc-500" /></div>

    if (!metrics) return null

    const hourlyData = (metrics.hourly || []).map((h: any) => {
        // Convert UTC hour from database to local hour explicitly
        const utcDate = new Date();
        utcDate.setUTCHours(h.hour, 0, 0, 0);
        
        // Format as 12-hour time (e.g., "2 PM") for better readability
        const label = utcDate.toLocaleTimeString([], { hour: 'numeric', hour12: true });
        
        return {
            name: label,
            // Keep original hour for sorting if needed, but array is usually sorted by server
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
            <Card className="border-zinc-800 bg-zinc-950/50">
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-zinc-400">Hourly Focus (Minutes)</CardTitle>
                </CardHeader>
                <CardContent className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={hourlyData}>
                            <XAxis 
                                dataKey="name" 
                                tick={{ fill: '#71717a', fontSize: 12 }} 
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis 
                                hide={false}
                                tick={{ fill: '#71717a', fontSize: 12 }} 
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#f4f4f5' }}
                                itemStyle={{ color: '#f4f4f5' }}
                                labelStyle={{ color: '#f4f4f5' }}
                                cursor={{ fill: '#27272a' }}
                                formatter={(value: number | undefined) => [formatDuration((value || 0) * 60), 'Focus Time']}
                            />
                            <Bar dataKey="minutes" fill="#22c55e" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* TOPIC DISTRIBUTION */}
            <Card className="border-zinc-800 bg-zinc-950/50">
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-zinc-400">Topic Distribution</CardTitle>
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
                                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#f4f4f5' }} 
                                itemStyle={{ color: '#f4f4f5' }}
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
