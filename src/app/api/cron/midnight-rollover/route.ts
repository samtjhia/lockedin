import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { differenceInSeconds } from 'date-fns'

const TORONTO_TZ = 'America/Toronto'
const MAX_ACTIVE_SEGMENT_SECONDS = 8 * 3600

/** Returns ISO string for midnight at the start of "today" in America/Toronto. */
function getStartOfTodayTorontoISO(): string {
  const now = new Date()
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: TORONTO_TZ })
  const [y, month, day] = todayStr.split('-').map(Number)
  for (let utcHour = 0; utcHour < 24; utcHour++) {
    const d = new Date(Date.UTC(y, month - 1, day, utcHour, 0, 0, 0))
    const inToronto = d.toLocaleString('en-CA', {
      timeZone: TORONTO_TZ,
      hour: '2-digit',
      hour12: false,
      minute: '2-digit',
    })
    if (inToronto === '00:00') return d.toISOString()
  }
  return new Date(Date.UTC(y, month - 1, day, 5, 0, 0, 0)).toISOString()
}

/** True when current time in Toronto is in 00:00–00:05 (optional gate for hourly cron). */
function isInMidnightWindowToronto(): boolean {
  const now = new Date()
  const hour = parseInt(
    now.toLocaleString('en-CA', { timeZone: TORONTO_TZ, hour: '2-digit', hour12: false }),
    10
  )
  const minute = parseInt(
    now.toLocaleString('en-CA', { timeZone: TORONTO_TZ, minute: '2-digit' }),
    10
  )
  return hour === 0 && minute <= 5
}

function getDateToronto(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: TORONTO_TZ })
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret) {
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (token !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  if (!isInMidnightWindowToronto()) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'not_midnight_toronto' })
  }

  let supabase
  try {
    supabase = createAdminClient()
  } catch (e) {
    console.error('[midnight-rollover] admin client:', e)
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const todayToronto = new Date().toLocaleDateString('en-CA', { timeZone: TORONTO_TZ })
  const midnightISO = getStartOfTodayTorontoISO()
  const endedAt = new Date(midnightISO)

  const { data: sessions, error: fetchError } = await supabase
    .from('sessions')
    .select('*')
    .in('status', ['active', 'paused'])
    .order('last_resumed_at', { ascending: false })

  if (fetchError) {
    console.error('[midnight-rollover] fetch sessions:', fetchError)
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
  }

  const toRollOver = (sessions ?? []).filter((s) => getDateToronto(s.started_at) < todayToronto)
  let rolled = 0

  for (const session of toRollOver) {
    let durationSeconds = session.accumulated_seconds ?? 0
    if (session.status === 'active' && session.last_resumed_at) {
      const lastResumed = new Date(session.last_resumed_at)
      const segmentSeconds = Math.max(0, differenceInSeconds(endedAt, lastResumed))
      durationSeconds += Math.min(segmentSeconds, MAX_ACTIVE_SEGMENT_SECONDS)
    }

    const { error: updateError } = await supabase
      .from('sessions')
      .update({
        ended_at: midnightISO,
        duration_seconds: durationSeconds,
        status: 'completed',
        last_resumed_at: null,
      })
      .eq('id', session.id)

    if (updateError) {
      console.error('[midnight-rollover] end session', session.id, updateError)
      continue
    }

    await supabase
      .from('profiles')
      .update({ current_status: 'online', current_task: null })
      .eq('id', session.user_id)

    if (session.status === 'active') {
      const now = new Date().toISOString()
      const taskName = session.task_name?.trim() || 'Focus'
      const { error: insertError } = await supabase
        .from('sessions')
        .insert({
          user_id: session.user_id,
          task_name: taskName,
          mode: session.mode ?? 'stopwatch',
          status: 'active',
          started_at: now,
          last_resumed_at: now,
          accumulated_seconds: 0,
        })
        .select()
        .single()

      if (!insertError) {
        await supabase
          .from('profiles')
          .update({ current_status: 'active', current_task: taskName })
          .eq('id', session.user_id)
      }
    }

    rolled++
  }

  return NextResponse.json({ ok: true, rolled })
}
