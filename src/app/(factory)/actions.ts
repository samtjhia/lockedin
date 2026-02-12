'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function checkCurrentSession() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null

  const { data: session } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()
    
  return session
}

export async function punchIn(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) throw new Error('Not authenticated')

  const taskName = formData.get('taskName') as string
  const mode = formData.get('mode') as string || 'stopwatch'

  if (!taskName) {
     // Check if we are just verifying inputs or actual submit
     return { error: 'Task name is required' }
  }

  // 1. Create new Session
  const { error: sessionError } = await supabase
    .from('sessions')
    .insert({
      user_id: user.id,
      task_name: taskName,
      mode: mode,
      status: 'active',
      started_at: new Date().toISOString()
    })

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
  return { success: true }
}

export async function punchOut(sessionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) throw new Error('Not authenticated')

  // 1. Get the session start time to calculate exact duration
  const { data: session } = await supabase
    .from('sessions')
    .select('started_at')
    .eq('id', sessionId)
    .single()

  if (!session) return { error: 'Session not found' }

  const verifyEnd = new Date()
  const startTime = new Date(session.started_at)
  const durationSeconds = Math.floor((verifyEnd.getTime() - startTime.getTime()) / 1000)

  // 2. Close Session
  const { error } = await supabase
    .from('sessions')
    .update({
      ended_at: verifyEnd.toISOString(),
      duration_seconds: durationSeconds,
      status: 'completed'
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

  revalidatePath('/dashboard')
  return { success: true }
}
