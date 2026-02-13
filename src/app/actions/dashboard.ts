'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getHeatmapData() {
  const supabase = await createClient()
  
  // Get data for the last 365 days
  const today = new Date()
  const oneYearAgo = new Date(today)
  oneYearAgo.setFullYear(today.getFullYear() - 1)
  
  const { data, error } = await supabase.rpc('get_heatmap_data', {
    start_date: oneYearAgo.toISOString()
  })
  
  if (error) {
    console.error('Error fetching heatmap data:', error)
    return []
  }
  
  // Format for react-activity-calendar
  return (data || []).map((entry: any) => ({
    date: entry.date,
    count: Number(entry.count),
    level: entry.level
  }))
}

export async function getDailyMetrics(date?: Date) {
  const supabase = await createClient()
  
  // Fix: Ensure we use Toronto time to determine "Today"
  // If we leave it as new Date().toISOString(), it uses UTC, which might be "Tomorrow" already.
  const targetDate = date 
    ? date.toISOString().split('T')[0] 
    : new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
  
  const { data, error } = await supabase.rpc('get_daily_metrics', {
    target_date: targetDate
  })
  
  if (error) {
    console.error('Error fetching daily metrics:', error)
    return null
  }
  
  return data
}

export async function getShiftLog(date?: Date) {
  const supabase = await createClient()
  const targetDate = date || new Date()
  
  // Start of day
  const startOfDay = new Date(targetDate)
  startOfDay.setHours(0, 0, 0, 0)
  
  // End of day
  const endOfDay = new Date(targetDate)
  endOfDay.setHours(23, 59, 59, 999)
  
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
    .gte('started_at', startOfDay.toISOString())
    .lte('started_at', endOfDay.toISOString())
    .eq('status', 'completed')
    .order('ended_at', { ascending: false })
    .order('started_at', { ascending: false })
    
  if (error) {
    console.error('Error fetching shift log:', error)
    return []
  }
  
  return data
}

export async function getTodos() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .order('is_completed', { ascending: true })
    .order('created_at', { ascending: false })
    
  if (error) {
    console.error('Error fetching todos:', error)
    return []
  }
  
  return data
}

export async function addTodo(taskName: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('todos')
    .insert({ task_name: taskName, user_id: (await supabase.auth.getUser()).data.user?.id })
    .select()
    .single()
    
  if (error) {
    console.error('Error adding todo:', error)
    return { success: false, error: error.message }
  }
  
  return { success: true, data }
}

export async function toggleTodo(id: string, isCompleted: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('todos')
    .update({ 
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null
    })
    .eq('id', id)
    
  if (error) {
    console.error('Error toggling todo:', error)
    return { success: false, error: error.message }
  }
  
  return { success: true }
}

export async function deleteTodo(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('todos')
    .delete()
    .eq('id', id)
    
  if (error) {
    console.error('Error deleting todo:', error)
    return { success: false, error: error.message }
  }
  
  return { success: true }
}

export async function clearCompletedTodos() {
  const supabase = await createClient()
  const { error } = await supabase
    .from('todos')
    .delete()
    .eq('is_completed', true)
    
  if (error) {
    console.error('Error clearing completed todos:', error)
    return { success: false, error: error.message }
  }
  
  return { success: true }
}

export async function deleteSession(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  // Verify existence and ownership first
  const { data: session, error: findError } = await supabase
    .from('sessions')
    .select('id, user_id')
    .eq('id', id)
    .single()

  if (findError || !session) {
    return { success: false, error: 'Session not found (Read check failed)' }
  }

  if (session.user_id !== user.id) {
    return { success: false, error: 'Unauthorized: You do not own this session' }
  }

  // Attempt Delete
  const { error, count } = await supabase
    .from('sessions')
    .delete({ count: 'exact' })
    .eq('id', id)

  if (error) {
    console.error('Error deleting session:', error)
    return { success: false, error: error.message }
  }

  if (count === 0) {
    return { success: false, error: 'Delete failed: RLS Policy likely preventing deletion' }
  }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateSessionName(id: string, name: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('sessions')
    .update({ task_name: name })
    .eq('id', id)

  if (error) {
    console.error('Error updating session:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}
