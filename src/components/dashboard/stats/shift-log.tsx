'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getShiftLog, deleteSession, updateSessionName } from '@/app/actions/dashboard'
import { formatDistanceToNow } from 'date-fns'
import { CheckCircle2, Clock, Pencil, Trash2, X, Check } from 'lucide-react'
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

export function ShiftLog() {
    const [logs, setLogs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState('')
    const [deletingId, setDeletingId] = useState<string | null>(null)

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

    if (loading) return <div className="h-[200px] w-full animate-pulse bg-zinc-900 rounded-xl" />

    return (
        <>
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
                                                        className="h-7 text-xs bg-zinc-900 border-zinc-700 text-zinc-100"
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleEditSave(session.id)
                                                            if (e.key === 'Escape') handleEditCancel()
                                                        }}
                                                    />
                                                    <Button size="icon" variant="ghost" className="h-6 w-6 text-green-500 hover:text-green-400" onClick={() => handleEditSave(session.id)}>
                                                        <Check className="w-3 h-3" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="h-6 w-6 text-zinc-500 hover:text-red-400" onClick={handleEditCancel}>
                                                        <X className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between group/item">
                                                    <div className='space-y-1'>
                                                        <p className="text-sm font-medium text-zinc-200 leading-none">
                                                            {session.task_name || 'Untitled Task'}
                                                        </p>
                                                        <div className="flex items-center text-xs text-zinc-500 gap-2">
                                                            <span>{formatDuration(session.duration_seconds)} focus</span>
                                                            <span>•</span>
                                                            <span>{formatDistanceToNow(new Date(session.ended_at), { addSuffix: true })}</span>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="opacity-0 group-hover/item:opacity-100 flex items-center gap-1 transition-opacity">
                                                        <Button 
                                                            size="icon" 
                                                            variant="ghost" 
                                                            className="h-6 w-6 text-zinc-500 hover:text-zinc-300" 
                                                            onClick={() => handleEditStart(session)}
                                                            title="Rename"
                                                        >
                                                            <Pencil className="w-3 h-3" />
                                                        </Button>
                                                        <Button 
                                                            size="icon" 
                                                            variant="ghost" 
                                                            className="h-6 w-6 text-zinc-500 hover:text-red-400" 
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

            <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
                <AlertDialogContent className="bg-zinc-900 border-zinc-800">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-zinc-100">Delete Session?</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400">
                            This will remove this session from your logs and analytics. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-transparent border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-900 text-red-100 hover:bg-red-800">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
