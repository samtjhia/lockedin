'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getShiftLog } from '@/app/actions/dashboard'
import { formatDistanceToNow } from 'date-fns'
import { CheckCircle2, Clock } from 'lucide-react'
import { formatDuration } from '@/lib/utils'

export function ShiftLog() {
    const [logs, setLogs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const loadLogs = () => {
        getShiftLog().then(data => {
            setLogs(data || [])
            setLoading(false)
        })
    }

    useEffect(() => {
        loadLogs()
        // Listen for session completion
        window.addEventListener('session-completed', loadLogs)
        return () => window.removeEventListener('session-completed', loadLogs)
    }, [])

    if (loading) return <div className="h-[200px] w-full animate-pulse bg-zinc-900 rounded-xl" />

    return (
        <Card className="border-zinc-800 bg-zinc-950/50 h-full flex flex-col">
            <CardHeader className="flex-shrink-0">
                <CardTitle className="text-zinc-400 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Session Log
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-[300px] lg:max-h-[600px] overflow-hidden flex flex-col p-4">
                <ScrollArea className="flex-1 w-full h-full [&>[data-radix-scroll-area-viewport]]:flex [&>[data-radix-scroll-area-viewport]]:flex-col">
                    {logs.length === 0 ? (
                        <div className="flex items-center justify-center h-full flex-1">
                             <p className="text-zinc-500 text-center py-4 text-sm">No completed sessions yet today.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col flex-1 gap-4">
                            {logs.map((session) => (
                                <div key={session.id} className="flex items-start gap-3 group shrink-0">
                                    <div className="mt-1">
                                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <p className="text-sm font-medium text-zinc-200 leading-none">
                                            {session.task_name || 'Untitled Task'}
                                        </p>
                                        <div className="flex items-center text-xs text-zinc-500 gap-2">
                                            <span>{formatDuration(session.duration_seconds)} focus</span>
                                            <span>•</span>
                                            <span>{formatDistanceToNow(new Date(session.ended_at), { addSuffix: true })}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
    )
}
