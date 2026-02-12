'use server'

import { createClient } from '@/utils/supabase/server'

export async function getLeaderboardData(period: 'daily' | 'weekly') {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_leaderboard', { period })
  
  if (error) {
    console.error('Leaderboard fetch error:', error)
    return []
  }
  
  return data
}

export async function getUserTopTasks(userId: string, period: 'daily' | 'weekly') {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('get_user_top_tasks', { 
        target_user_id: userId, 
        period 
    })

    if (error) {
        console.error('Tasks fetch error:', error)
        return []
    }
    return data
}
