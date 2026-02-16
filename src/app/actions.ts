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

// --- Leaderboard history and medals ---

export async function getLeaderboardForDate(targetDate: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_leaderboard_for_date', {
    target_date: targetDate,
  })
  if (error) {
    console.error('Leaderboard for date error:', error)
    return []
  }
  return data || []
}

export async function getLeaderboardForWeek(weekStart: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_leaderboard_for_week', {
    week_start: weekStart,
  })
  if (error) {
    console.error('Leaderboard for week error:', error)
    return []
  }
  return data || []
}

export type MedalCountEntry = {
  user_id: string
  username: string | null
  avatar_url: string | null
  gold_daily: number
  silver_daily: number
  bronze_daily: number
  gold_weekly: number
  silver_weekly: number
  bronze_weekly: number
}

export async function getLeaderboardMedalCounts(weeksBack: number = 6): Promise<MedalCountEntry[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_leaderboard_medal_counts', {
    weeks_back: weeksBack,
  })
  if (error) {
    console.error('Leaderboard medal counts error:', error)
    return []
  }
  return (data || []).map((row: any) => ({
    user_id: row.user_id,
    username: row.username,
    avatar_url: row.avatar_url,
    gold_daily: Number(row.gold_daily ?? 0),
    silver_daily: Number(row.silver_daily ?? 0),
    bronze_daily: Number(row.bronze_daily ?? 0),
    gold_weekly: Number(row.gold_weekly ?? 0),
    silver_weekly: Number(row.silver_weekly ?? 0),
    bronze_weekly: Number(row.bronze_weekly ?? 0),
  }))
}

export type TimelinePeriod = {
  period_type: 'daily' | 'weekly'
  period_label: string
  period_date: string
  standings: { rank: number; user_id: string; username: string | null; total_seconds: number }[]
}

export async function getLeaderboardTimeline(weeksBack: number = 6): Promise<TimelinePeriod[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_leaderboard_timeline', {
    weeks_back: weeksBack,
  })
  if (error) {
    console.error('Leaderboard timeline error:', error)
    return []
  }
  const arr = Array.isArray(data) ? data : (data ? JSON.parse(JSON.stringify(data)) : [])
  return arr.map((p: any) => ({
    period_type: p.period_type,
    period_label: p.period_label,
    period_date: p.period_date,
    standings: (p.standings || []).map((s: any) => ({
      rank: Number(s.rank),
      user_id: s.user_id,
      username: s.username ?? null,
      total_seconds: Number(s.total_seconds ?? 0),
    })),
  }))
}
