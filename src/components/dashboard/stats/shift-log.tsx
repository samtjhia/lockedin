'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getShiftLog, deleteSession, updateSessionName } from '@/app/actions/dashboard'
import { formatDistanceToNow } from 'date-fns'
import { CheckCircle2, Clock, Pencil, Trash2, X, Check, Timer } from 'lucide-react'
import { EditSessionEndTimeDialog, type SessionForEditEndTime } from '@/components/dashboard/edit-session-end-time-dialog'
import { formatDuration } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

type ShiftLogProps = {
    initialLogs?: any[]
}

export function ShiftLog({ initialLogs }: ShiftLogProps) {
    const [logs, setLogs] = useState<any[]>(initialLogs ?? [])
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState('')
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [editingEndTimeSession, setEditingEndTimeSession] = useState<SessionForEditEndTime | null>(null)

    const loadLogs = () => {
        getShiftLog().then(data => setLogs(data || []))
    }

    useEffect(() => {
        // Only fetch if no initial data
        if (!initialLogs) loadLogs()
        // Listen for session completion
        window.addEventListener('session-completed', loadLogs)
        return () => window.removeEventListener('session-completed', loadLogs)
    }, [initialLogs])

    const handleEditStart = (session: any) => {
        setEditingId(session.id)
        setEditName(session.task_name || '')
    }

    const handleEditCancel = () => {
        setEditingId(null)
        setEditName('')
    }

    const handleEditSave = async (id: string) => {
        const res = await updateSessionName(id, editName)
        if (res.success) {
            toast.success('Session renamed')
            loadLogs()
            window.dispatchEvent(new Event('session-completed'))
            setEditingId(null)
        } else {
            toast.error('Failed to rename session')
        }
    }

    const handleDelete = async () => {
        if (!deletingId) return
        const res = await deleteSession(deletingId)
        if (res.success) {
            toast.success('Session deleted')
            loadLogs()
            window.dispatchEvent(new Event('session-completed'))
        } else {
            toast.error(res.error || 'Failed to delete session')
        }
        setDeletingId(null)
    }

    return (
        <>
            <Card className="border-border bg-muted/50 h-full flex flex-col">
                <CardHeader className="flex-shrink-0">
                    <CardTitle className="text-muted-foreground flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Session Log
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 min-h-0 overflow-hidden flex flex-col p-4">
                    <ScrollArea className="flex-1 w-full h-full [&>[data-radix-scroll-area-viewport]]:flex [&>[data-radix-scroll-area-viewport]]:flex-col">
                        {logs.length === 0 ? (
                            <div className="flex items-center justify-center h-full flex-1">
                                <p className="text-muted-foreground text-center py-4 text-sm">No completed sessions yet today.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col flex-1 gap-4 pr-3">
                                {logs.map((session) => (
                                    <div key={session.id} className="flex items-start gap-3 group shrink-0 min-h-[40px]">
                                        <div className="mt-1">
                                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            {editingId === session.id ? (
                                                <div className="flex items-center gap-2">
                                                    <Input 
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        className="h-7 text-xs bg-card border-border text-foreground"
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleEditSave(session.id)
                                                            if (e.key === 'Escape') handleEditCancel()
                                                        }}
                                                    />
                                                    <Button size="icon" variant="ghost" className="h-6 w-6 text-green-500 hover:text-green-400" onClick={() => handleEditSave(session.id)}>
                                                        <Check className="w-3 h-3" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-red-400" onClick={handleEditCancel}>
                                                        <X className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between group/item">
                                                    <div className='space-y-1'>
                                                        <p className="text-sm font-medium text-foreground leading-none">
                                                            {session.task_name || 'Untitled Task'}
                                                        </p>
                                                        <div className="flex items-center text-xs text-muted-foreground gap-1.5 flex-wrap">
                                                            <span className="whitespace-nowrap">{formatDuration(session.duration_seconds)} focus</span>
                                                            <span>•</span>
                                                            <span className="whitespace-nowrap" suppressHydrationWarning>{formatDistanceToNow(new Date(session.ended_at), { addSuffix: true })}</span>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-1 shrink-0 opacity-100 lg:opacity-0 lg:group-hover/item:opacity-100 transition-opacity">
                                                        <Button 
                                                            size="icon" 
                                                            variant="ghost" 
                                                            className="h-6 w-6 text-foreground/70 hover:text-foreground" 
                                                            onClick={() => setEditingEndTimeSession({ id: session.id, started_at: session.started_at, ended_at: session.ended_at, duration_seconds: session.duration_seconds, task_name: session.task_name })}
                                                            title="Edit end time"
                                                        >
                                                            <Timer className="w-3 h-3" />
                                                        </Button>
                                                        <Button 
                                                            size="icon" 
                                                            variant="ghost" 
                                                            className="h-6 w-6 text-muted-foreground hover:text-foreground/70" 
                                                            onClick={() => handleEditStart(session)}
                                                            title="Rename"
                                                        >
                                                            <Pencil className="w-3 h-3" />
                                                        </Button>
                                                        <Button 
                                                            size="icon" 
                                                            variant="ghost" 
                                                            className="h-6 w-6 text-muted-foreground hover:text-red-400" 
                                                            onClick={() => setDeletingId(session.id)}
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </CardContent>
            </Card>

            <EditSessionEndTimeDialog
                session={editingEndTimeSession}
                open={!!editingEndTimeSession}
                onOpenChange={(open) => !open && setEditingEndTimeSession(null)}
                onSuccess={() => {
                    loadLogs()
                    window.dispatchEvent(new Event('session-completed'))
                }}
            />

            <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
                <AlertDialogContent className="bg-card border-border">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-foreground">Delete Session?</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground">
                            This will remove this session from your logs and analytics. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-transparent border-border text-foreground/70 hover:bg-muted hover:text-foreground">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-900 text-red-100 hover:bg-red-800">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
