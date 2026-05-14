'use client'

import { useState, useEffect, useRef } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  applyCompletedSessionCorrections,
  type SessionCorrectionSegment,
} from '@/app/actions/dashboard'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { formatDuration } from '@/lib/utils'

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

function localInputToIso(local: string): string | null {
  const d = new Date(local)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

const MIN_SEGMENT_SECONDS = 60
const MAX_SEGMENTS = 8

type EditSessionEndTimeDialogProps = {
  session: SessionForEditEndTime | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type PendingCorrection = {
  finalEndedAt: string
  segments: SessionCorrectionSegment[]
  summaryLines: string[]
}

type CorrectSessionBodyProps = {
  session: SessionForEditEndTime
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function CorrectSessionBody({ session, onOpenChange, onSuccess }: CorrectSessionBodyProps) {
  const [finalEndLocal, setFinalEndLocal] = useState(() => toDateTimeLocal(session.ended_at))
  const [splitEnabled, setSplitEnabled] = useState(false)
  const [segmentTasks, setSegmentTasks] = useState(() => [session.task_name?.trim() || ''])
  const [segmentEndsLocal, setSegmentEndsLocal] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [pendingCorrection, setPendingCorrection] = useState<PendingCorrection | null>(null)

  const splitFormRef = useRef({
    segmentTasks,
    segmentEndsLocal,
    finalEndLocal,
    session,
  })

  useEffect(() => {
    splitFormRef.current = { segmentTasks, segmentEndsLocal, finalEndLocal, session }
  }, [segmentTasks, segmentEndsLocal, finalEndLocal, session])

  const startedAt = new Date(session.started_at)
  const originalEndedAt = new Date(session.ended_at)

  const setFirstTask = (v: string) => {
    setSegmentTasks((prev) => {
      const next = [...prev]
      next[0] = v
      return next
    })
  }

  const setTaskAt = (index: number, v: string) => {
    setSegmentTasks((prev) => {
      const next = [...prev]
      next[index] = v
      return next
    })
  }

  const setEndAt = (index: number, v: string) => {
    setSegmentEndsLocal((prev) => {
      const next = [...prev]
      next[index] = v
      return next
    })
  }

  const handleSplitChecked = (checked: boolean) => {
    if (checked) {
      const startMs = new Date(session.started_at).getTime()
      const endMs = new Date(session.ended_at).getTime()
      const midMs = Math.floor((startMs + endMs) / 2)
      const midIso = new Date(midMs).toISOString()
      setSplitEnabled(true)
      setSegmentTasks([session.task_name?.trim() || '', ''])
      setSegmentEndsLocal([toDateTimeLocal(midIso)])
    } else {
      setSplitEnabled(false)
      setSegmentTasks((t) => [t[0] ?? session.task_name?.trim() ?? ''])
      setSegmentEndsLocal([])
    }
  }

  const addSegment = () => {
    const { segmentTasks: tasks, segmentEndsLocal: ends, finalEndLocal: finLoc, session: sess } =
      splitFormRef.current
    if (tasks.length >= MAX_SEGMENTS) return
    const finIso = localInputToIso(finLoc) || sess.ended_at
    const finMs = new Date(finIso).getTime()
    let lastMs = new Date(sess.started_at).getTime()
    if (ends.length > 0) {
      const lastEnd = localInputToIso(ends[ends.length - 1])
      if (lastEnd) lastMs = new Date(lastEnd).getTime()
    }
    const midMs = Math.floor((lastMs + finMs) / 2)
    setSegmentTasks([...tasks, ''])
    setSegmentEndsLocal([...ends, toDateTimeLocal(new Date(midMs).toISOString())])
  }

  const removeLastSegment = () => {
    setSegmentTasks((tasks) => {
      if (tasks.length <= 2) return tasks
      return tasks.slice(0, -1)
    })
    setSegmentEndsLocal((ends) => {
      if (ends.length <= 1) return ends
      return ends.slice(0, -1)
    })
  }

  const buildPendingCorrection = (): PendingCorrection | null => {
    const finalIso = localInputToIso(finalEndLocal)
    if (!finalIso) {
      toast.error('Invalid session end time')
      return null
    }
    const finalEnd = new Date(finalIso)
    if (Number.isNaN(finalEnd.getTime())) {
      toast.error('Invalid session end time')
      return null
    }
    if (finalEnd < startedAt) {
      toast.error('End time cannot be earlier than the start time')
      return null
    }
    if (finalEnd > originalEndedAt) {
      toast.error('End time cannot be later than the current end time')
      return null
    }

    const n = splitEnabled ? segmentTasks.length : 1
    if (splitEnabled && n < 2) {
      toast.error('Add at least two subjects to split')
      return null
    }

    const tasks = splitEnabled ? segmentTasks : [segmentTasks[0] ?? '']
    for (let i = 0; i < tasks.length; i++) {
      if (!tasks[i]?.trim()) {
        toast.error(`Subject ${i + 1} needs a name`)
        return null
      }
    }

    const segments: SessionCorrectionSegment[] = []
    const summaryLines: string[] = []
    let cursor = startedAt.getTime()

    if (!splitEnabled) {
      const dur = Math.max(0, Math.floor((finalEnd.getTime() - cursor) / 1000))
      if (dur < MIN_SEGMENT_SECONDS) {
        toast.error(`Session must be at least ${MIN_SEGMENT_SECONDS} seconds`)
        return null
      }
      segments.push({
        taskName: tasks[0].trim(),
        endedAt: finalIso,
      })
      summaryLines.push(
        `${tasks[0].trim()} — ${format(startedAt, 'MMM d, h:mm a')} → ${format(finalEnd, 'MMM d, h:mm a')} (${formatDuration(dur)})`
      )
      return { finalEndedAt: finalIso, segments, summaryLines }
    }

    const endsIso: string[] = []
    for (let i = 0; i < n - 1; i++) {
      const iso = localInputToIso(segmentEndsLocal[i] || '')
      if (!iso) {
        toast.error(`Invalid end time for subject ${i + 1}`)
        return null
      }
      endsIso.push(iso)
    }

    for (let i = 0; i < n; i++) {
      const endIso = i === n - 1 ? finalIso : endsIso[i]
      const endDate = new Date(endIso)
      if (endDate <= new Date(cursor)) {
        toast.error('Each subject must end after the previous one starts')
        return null
      }
      if (endDate > originalEndedAt) {
        toast.error('A segment cannot end after the original session end')
        return null
      }
      const dur = Math.floor((endDate.getTime() - cursor) / 1000)
      if (dur < MIN_SEGMENT_SECONDS) {
        toast.error(`Each segment must be at least ${MIN_SEGMENT_SECONDS} seconds`)
        return null
      }
      segments.push({ taskName: tasks[i].trim(), endedAt: endIso })
      summaryLines.push(
        `${tasks[i].trim()} — ${format(new Date(cursor), 'MMM d, h:mm a')} → ${format(endDate, 'MMM d, h:mm a')} (${formatDuration(dur)})`
      )
      cursor = endDate.getTime()
    }

    if (Math.abs(cursor - finalEnd.getTime()) > 1000) {
      toast.error('Last subject must run through the session end time')
      return null
    }

    return { finalEndedAt: finalIso, segments, summaryLines }
  }

  const validateAndShowConfirm = (e: React.FormEvent) => {
    e.preventDefault()
    const pending = buildPendingCorrection()
    if (!pending) return
    setPendingCorrection(pending)
  }

  const handleConfirmSave = async () => {
    if (!pendingCorrection) return
    setSaving(true)
    const res = await applyCompletedSessionCorrections(
      session.id,
      pendingCorrection.finalEndedAt,
      pendingCorrection.segments
    )
    setSaving(false)
    setPendingCorrection(null)
    if (res.success) {
      toast.success(
        pendingCorrection.segments.length > 1 ? 'Session split and saved' : 'Session updated'
      )
      onSuccess()
      onOpenChange(false)
    } else {
      toast.error(res.error ?? 'Failed to update')
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-foreground">Correct session</DialogTitle>
        <DialogDescription className="text-muted-foreground">
          Adjust when the session ended and, if needed, split the same time range into multiple subjects. End time
          cannot be later than when you originally ended the session.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={validateAndShowConfirm} className="space-y-4">
        <div className="space-y-2 datetime-input-wrap">
          <Label htmlFor="edit-end-time" className="text-foreground">
            Session end time
          </Label>
          <Input
            id="edit-end-time"
            type="datetime-local"
            value={finalEndLocal}
            onChange={(e) => setFinalEndLocal(e.target.value)}
            min={toDateTimeLocal(session.started_at)}
            max={toDateTimeLocal(session.ended_at)}
            className="border-border placeholder:text-muted-foreground"
          />
          <p className="text-xs text-muted-foreground">
            Allowed: between {format(startedAt, 'MMM d, h:mm a')} and {format(originalEndedAt, 'MMM d, h:mm a')}{' '}
            (original end).
          </p>
        </div>

        <div className="flex items-start gap-3 rounded-md border border-border p-3">
          <Checkbox
            id="edit-session-split"
            checked={splitEnabled}
            onCheckedChange={(v) => handleSplitChecked(v === true)}
            className="mt-0.5"
          />
          <div className="grid gap-1.5 leading-none">
            <label htmlFor="edit-session-split" className="text-sm font-medium text-foreground cursor-pointer">
              Split into multiple subjects
            </label>
            <p className="text-xs text-muted-foreground">
              Same total time is kept; each stretch gets its own name (e.g. math then bio).
            </p>
          </div>
        </div>

        {!splitEnabled && (
          <div className="space-y-2">
            <Label htmlFor="edit-session-task" className="text-foreground">
              Subject
            </Label>
            <Input
              id="edit-session-task"
              value={segmentTasks[0] ?? ''}
              onChange={(e) => setFirstTask(e.target.value)}
              className="border-border placeholder:text-muted-foreground"
              placeholder="Task name"
            />
          </div>
        )}

        {splitEnabled && segmentTasks.length >= 2 && (
          <div className="space-y-4 rounded-md border border-border p-3">
            <p className="text-xs font-medium text-foreground">Subjects in order</p>
            {segmentTasks.map((task, idx) => {
              const isLast = idx === segmentTasks.length - 1
              return (
                <div key={idx} className="space-y-2 border-b border-border pb-3 last:border-0 last:pb-0">
                  <Label className="text-foreground text-sm">Subject {idx + 1}</Label>
                  <Input
                    value={task}
                    onChange={(e) => setTaskAt(idx, e.target.value)}
                    className="border-border placeholder:text-muted-foreground"
                    placeholder="Task name"
                  />
                  {!isLast && (
                    <div className="space-y-1 datetime-input-wrap">
                      <Label className="text-muted-foreground text-xs">Until</Label>
                      <Input
                        type="datetime-local"
                        value={segmentEndsLocal[idx] ?? ''}
                        onChange={(e) => setEndAt(idx, e.target.value)}
                        min={toDateTimeLocal(session.started_at)}
                        max={finalEndLocal || undefined}
                        className="border-border placeholder:text-muted-foreground"
                      />
                    </div>
                  )}
                  {isLast && (
                    <p className="text-xs text-muted-foreground">
                      Runs until session end (
                      {format(new Date(localInputToIso(finalEndLocal) || session.ended_at), 'MMM d, h:mm a')}).
                    </p>
                  )}
                </div>
              )
            })}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-border"
                onClick={addSegment}
                disabled={segmentTasks.length >= MAX_SEGMENTS}
              >
                Add subject
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-border"
                onClick={removeLastSegment}
                disabled={segmentTasks.length <= 2}
              >
                Remove last subject
              </Button>
            </div>
          </div>
        )}

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

      <AlertDialog open={!!pendingCorrection} onOpenChange={(o) => !o && setPendingCorrection(null)}>
        <AlertDialogContent className="bg-card border-border max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Confirm session correction</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-muted-foreground">
                <p>
                  Session ends at{' '}
                  <strong className="text-foreground font-semibold">
                    {pendingCorrection
                      ? format(new Date(pendingCorrection.finalEndedAt), "EEEE, MMMM d, yyyy 'at' h:mm a")
                      : ''}
                  </strong>
                  .
                </p>
                {pendingCorrection && pendingCorrection.summaryLines.length > 0 && (
                  <ul className="list-disc space-y-1.5 pl-4 text-sm">
                    {pendingCorrection.summaryLines.map((line, i) => (
                      <li key={i} className="text-foreground/90">
                        {line}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
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

export function EditSessionEndTimeDialog({
  session,
  open,
  onOpenChange,
  onSuccess,
}: EditSessionEndTimeDialogProps) {
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
        <DialogContent className="edit-end-time-dialog bg-card border-border sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
          {session && (
            <CorrectSessionBody key={session.id} session={session} onOpenChange={onOpenChange} onSuccess={onSuccess} />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
