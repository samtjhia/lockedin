'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { updateSessionEndTime } from '@/app/actions/dashboard'
import { toast } from 'sonner'
import { format } from 'date-fns'

export type SessionForEditEndTime = {
  id: string
  started_at: string
  ended_at: string
  duration_seconds?: number
  task_name?: string
}

function toDateTimeLocal(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

type EditSessionEndTimeDialogProps = {
  session: SessionForEditEndTime | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EditSessionEndTimeDialog({
  session,
  open,
  onOpenChange,
  onSuccess,
}: EditSessionEndTimeDialogProps) {
  const [newEndedAt, setNewEndedAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmEndTime, setConfirmEndTime] = useState<string | null>(null)

  const startedAt = session ? new Date(session.started_at) : null
  const endedAt = session ? new Date(session.ended_at) : null

  useEffect(() => {
    if (session && open) {
      setNewEndedAt(toDateTimeLocal(session.ended_at))
      setConfirmEndTime(null)
    }
  }, [session, open])

  const validateAndShowConfirm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!session) return
    const newEnd = new Date(newEndedAt)
    if (Number.isNaN(newEnd.getTime())) {
      toast.error('Invalid date or time')
      return
    }
    if (startedAt && newEnd < startedAt) {
      toast.error('End time cannot be earlier than the start time')
      return
    }
    if (endedAt && newEnd > endedAt) {
      toast.error('End time cannot be later than the current end time')
      return
    }
    setConfirmEndTime(newEnd.toISOString())
  }

  const handleConfirmSave = async () => {
    if (!session || !confirmEndTime) return
    setSaving(true)
    const res = await updateSessionEndTime(session.id, confirmEndTime)
    setSaving(false)
    setConfirmEndTime(null)
    if (res.success) {
      toast.success('Session end time updated')
      onSuccess()
      onOpenChange(false)
    } else {
      toast.error(res.error ?? 'Failed to update')
    }
  }

  if (!session) return null

  return (
    <>
      <style>{`
        .edit-end-time-dialog .datetime-input-wrap input[type="datetime-local"] {
          color-scheme: light;
          background: hsl(0 0% 14%);
          color: hsl(0 0% 98%);
        }
        .edit-end-time-dialog .datetime-input-wrap input[type="datetime-local"]::-webkit-calendar-picker-indicator {
          filter: invert(1) brightness(1.5);
          cursor: pointer;
          opacity: 1;
        }
        .edit-end-time-dialog input[type="datetime-local"]::-webkit-datetime-edit {
          color: inherit;
        }
      `}</style>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="edit-end-time-dialog bg-card border-border sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit end time</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              New end time must be no earlier than the start time and no later than the current end time.
              {session.task_name && (
                <span className="block mt-1 font-medium text-foreground/80 truncate" title={session.task_name}>
                  {session.task_name}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={validateAndShowConfirm} className="space-y-4">
            <div className="space-y-2 datetime-input-wrap">
              <Label htmlFor="edit-end-time" className="text-foreground">
                New end time
              </Label>
              <Input
                id="edit-end-time"
                type="datetime-local"
                value={newEndedAt}
                onChange={(e) => setNewEndedAt(e.target.value)}
                min={startedAt ? toDateTimeLocal(session.started_at) : undefined}
                max={endedAt ? toDateTimeLocal(session.ended_at) : undefined}
                className="border-border placeholder:text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">
                Allowed: between {startedAt ? format(startedAt, 'MMM d, h:mm a') : '—'} and {endedAt ? format(endedAt, 'MMM d, h:mm a') : '—'} (current end).
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-border text-foreground"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmEndTime} onOpenChange={(open) => !open && setConfirmEndTime(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Confirm new end time</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Change this session&apos;s end time to{' '}
              <strong className="text-foreground font-semibold">
                {confirmEndTime ? format(new Date(confirmEndTime), 'EEEE, MMMM d, yyyy \'at\' h:mm a') : ''}
              </strong>
              ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-foreground">Back</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSave} disabled={saving}>
              {saving ? 'Saving…' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
