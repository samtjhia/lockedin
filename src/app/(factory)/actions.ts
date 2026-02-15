'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { differenceInSeconds } from 'date-fns'

export async function checkCurrentSession() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: session } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', user.id)
    .in('status', ['active', 'paused'])
    .single()

  return session
}

export async function getPomoStats() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { count: 0, cycleSize: 4 }

    const { data: profile } = await supabase
        .from('profiles')
        .select('pomo_session_count, pomo_cycle_size')
        .eq('id', user.id)
        .single()
    
    const cycleSize = profile?.pomo_cycle_size ?? 4
    return { count: profile?.pomo_session_count || 0, cycleSize }
}

export async function updatePomoSettings(cycleSize: number) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }
    if (cycleSize < 2 || cycleSize > 20) return { error: 'Cycle size must be between 2 and 20' }

    const { error } = await supabase
        .from('profiles')
        .update({ pomo_cycle_size: cycleSize })
        .eq('id', user.id)
    if (error) return { error: error.message }
    revalidatePath('/dashboard')
    return { success: true }
}

export async function transitionSession(endedSessionId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    // 1. Get Ended Session Info to know what we just finished
    const { data: prevSession } = await supabase
        .from('sessions')
        .select('mode, task_name')
        .eq('id', endedSessionId)
        .single()
    
    if (!prevSession) return { error: 'Session not found' }

    // 2. Punch Out Old Session
    await punchOut(endedSessionId)

    // 3. Determine Next Mode
    let nextMode = 'stopwatch'
    let nextTaskName = ''
    
    // Get current cycle count, cycle size, and last focus task name (for restoring after break)
    const { data: profile } = await supabase
        .from('profiles')
        .select('pomo_session_count, pomo_cycle_size, last_pomo_task_name')
        .eq('id', user.id)
        .single()
    
    let currentCount = profile?.pomo_session_count || 0
    const cycleSize = profile?.pomo_cycle_size ?? 4

    if (prevSession.mode === 'pomo') {
        const newCount = currentCount + 1
        // Update count and persist focus task name so next focus session after break keeps it
        await supabase.from('profiles').update({
            pomo_session_count: newCount,
            last_pomo_task_name: prevSession.task_name?.trim() || null,
        }).eq('id', user.id)
        
        if (newCount % cycleSize === 0) {
            nextMode = 'long-break'
            nextTaskName = 'Long Break'
        } else {
            nextMode = 'short-break'
            nextTaskName = 'Short Break'
        }
    } else if (prevSession.mode === 'short-break' || prevSession.mode === 'long-break') {
        // Continue the pomo cycle: auto-start the next focus session with same title as before break
        nextMode = 'pomo'
        nextTaskName = (profile?.last_pomo_task_name?.trim()) || 'Focus'
    } else {
        // If it was stopwatch, just stop.
        return { success: true, stop: true }
    }

    // 4. Punch In New Session
    const formData = new FormData()
    formData.append('taskName', nextTaskName)
    formData.append('mode', nextMode)
    formData.append('isAuto', 'true') // Flag to prevent reset
    
    // Pass the new count back so the UI can update
    const result = await punchIn(formData)
    return { ...result, pomoSessionCount: currentCount + (prevSession.mode === 'pomo' ? 1 : 0) }
}

export async function punchIn(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) throw new Error('Not authenticated')

  const taskName = (formData.get('taskName') as string)?.trim()
  const mode = formData.get('mode') as string || 'stopwatch'
  const isAuto = formData.get('isAuto') === 'true'

  if (!taskName) {
     return { error: 'Task name is required' }
  }

  // When they manually start a pomo session, always restart the cycle at 1 (Loop 1/4).
  // Auto-started pomos (after a break) keep the current count.
  if (mode === 'pomo' && !isAuto) {
      await supabase
        .from('profiles')
        .update({ pomo_session_count: 0 })
        .eq('id', user.id)
  }

  const now = new Date().toISOString()

  // 1. Create new Session
  const { data: sessionData, error: sessionError } = await supabase
    .from('sessions')
    .insert({
      user_id: user.id,
      task_name: taskName,
      mode: mode,
      status: 'active',
      started_at: now,
      last_resumed_at: now,
      accumulated_seconds: 0
    })
    .select()
    .single()

  if (sessionError) {
    console.error('PunchIn Error:', sessionError)
    return { error: 'Failed to start session' }
  }

  // 2. Update Profile Status
  await supabase
    .from('profiles')
    .update({ 
      current_status: 'active',
      current_task: taskName 
    })
    .eq('id', user.id)

  revalidatePath('/dashboard')
  return { success: true, session: sessionData }
}

export async function pauseSession(sessionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get current session to calc delta
  const { data: session } = await supabase
    .from('sessions')
    .select('last_resumed_at, accumulated_seconds')
    .eq('id', sessionId)
    .single()
  
  if (!session || !session.last_resumed_at) return { error: 'Session not active' }

  const now = new Date()
  const lastResumed = new Date(session.last_resumed_at)
  const delta = Math.max(0, differenceInSeconds(now, lastResumed))
  const newAccumulated = (session.accumulated_seconds || 0) + delta

  const { data: updatedSession, error } = await supabase
    .from('sessions')
    .update({
        status: 'paused',
        last_resumed_at: null, // clear because it's not running
        accumulated_seconds: newAccumulated
    })
    .eq('id', sessionId)
    .select()
    .single()

  if (error) return { error: error.message }
  
  // Update Profile Status
  await supabase
    .from('profiles')
    .update({ current_status: 'paused' })
    .eq('id', user.id)

  revalidatePath('/dashboard')
  return { success: true, session: updatedSession }
}

export async function resumeSession(sessionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const now = new Date().toISOString()

  const { data: updatedSession, error } = await supabase
    .from('sessions')
    .update({
        status: 'active',
        last_resumed_at: now
    })
    .eq('id', sessionId)
    .select()
    .single()

  if (error) return { error: error.message }

  // Update Profile Status
  await supabase
    .from('profiles')
    .update({ current_status: 'active' })
    .eq('id', user.id)

  revalidatePath('/dashboard')
  return { success: true, session: updatedSession }
}

export async function punchOut(sessionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) throw new Error('Not authenticated')

  // 1. Get the session info
  const { data: session } = await supabase
    .from('sessions')
    .select('accumulated_seconds, last_resumed_at, status')
    .eq('id', sessionId)
    .single()

  if (!session) return { error: 'Session not found' }

  const now = new Date()
  let finalDuration = session.accumulated_seconds || 0

  // If active, add the final segment
  if (session.status === 'active' && session.last_resumed_at) {
    const lastResumed = new Date(session.last_resumed_at)
    finalDuration += Math.max(0, differenceInSeconds(now, lastResumed))
  }

  // 2. Close Session
  const { error } = await supabase
    .from('sessions')
    .update({
      ended_at: now.toISOString(),
      duration_seconds: finalDuration,
      status: 'completed',
      last_resumed_at: null 
    })
    .eq('id', sessionId)
    .eq('user_id', user.id)

  if (error) return { error: 'Failed to close session' }

  // 3. Update Profile Status (online = still in app, just no timer)
  await supabase
    .from('profiles')
    .update({ 
      current_status: 'online',
      current_task: null 
    })
    .eq('id', user.id)

  revalidatePath('/')
  revalidatePath('/dashboard')
  
  return { success: true }
}
