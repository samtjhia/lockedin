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
    if (!user) return { count: 0 }

    const { data: profile } = await supabase
        .from('profiles')
        .select('pomo_session_count')
        .eq('id', user.id)
        .single()
    
    return { count: profile?.pomo_session_count || 0 }
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
    
    // Get current cycle count
    const { data: profile } = await supabase
        .from('profiles')
        .select('pomo_session_count')
        .eq('id', user.id)
        .single()
    
    let currentCount = profile?.pomo_session_count || 0

    if (prevSession.mode === 'pomo') {
        const newCount = currentCount + 1
        // Update count
        await supabase.from('profiles').update({ pomo_session_count: newCount }).eq('id', user.id)
        
        if (newCount % 4 === 0) {
            nextMode = 'long-break'
            nextTaskName = 'Long Break'
        } else {
            nextMode = 'short-break'
            nextTaskName = 'Short Break'
        }
    } else if (prevSession.mode === 'short-break' || prevSession.mode === 'long-break') {
        // BUG FIX: Don't auto-start Pomo after break. Just stop.
        // Unless we want "auto-chaining" which the user said they didn't like ("it thinks it's in pomo mode and then auto starts").
        // Let's stop after a break.
        return { success: true, stop: true }
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

  // LOGIC: Reset cycle if starting manual session and it's been a while
  if (mode === 'pomo' && !isAuto) {
      // Check last session
      const { data: lastSession } = await supabase
        .from('sessions')
        .select('ended_at, mode')
        .eq('user_id', user.id)
        .order('ended_at', { ascending: false })
        .limit(1)
        .single()
      
      let shouldReset = false
      if (!lastSession || !lastSession.ended_at) {
          shouldReset = true
      } else {
          // Check staleness (e.g., > 30 mins break)
          const lastEnd = new Date(lastSession.ended_at)
          const diffMins = (new Date().getTime() - lastEnd.getTime()) / 60000
          
          if (diffMins > 30) {
              shouldReset = true
          }
          // Also reset if switching from non-pomo modes (like stopwatch)
          if (!['pomo', 'short-break', 'long-break'].includes(lastSession.mode)) {
              shouldReset = true
          }
      }

      if (shouldReset) {
          await supabase
            .from('profiles')
            .update({ pomo_session_count: 0 })
            .eq('id', user.id)
      }
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

  // 3. Update Profile Status
  await supabase
    .from('profiles')
    .update({ 
      current_status: 'offline',
      current_task: null 
    })
    .eq('id', user.id)

  revalidatePath('/')
  revalidatePath('/dashboard')
  
  return { success: true }
}
