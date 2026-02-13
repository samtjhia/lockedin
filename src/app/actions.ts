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

export async function getUserHeatmapData(userId: string) {
    const supabase = await createClient()
    
    // Get last 365 days for full year
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    
    const { data, error } = await supabase.rpc('get_user_heatmap_data', {
        target_user_id: userId,
        start_date: oneYearAgo.toISOString()
    })
    
    if (error) {
        console.error('Heatmap fetch error:', error)
        return []
    }
    
    return data || []
}

export async function getLeaderboardHeatmaps(userIds: string[]) {
    const supabase = await createClient()
    
    // Get last 365 days for full year heatmap
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    
    // Fetch all heatmaps in parallel
    const results = await Promise.all(
        userIds.map(async (userId) => {
            const { data, error } = await supabase.rpc('get_user_heatmap_data', {
                target_user_id: userId,
                start_date: oneYearAgo.toISOString()
            })
            return { userId, data: data || [], error }
        })
    )
    
    // Convert to map
    const heatmapMap: Record<string, { date: string, count: number, level: number }[]> = {}
    results.forEach(r => {
        if (!r.error) {
            heatmapMap[r.userId] = r.data
        }
    })
    
    return heatmapMap
}
