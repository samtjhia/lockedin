'use server'

import { createClient } from '@/utils/supabase/server'

export async function getHistoryCalendarData() {
  const supabase = await createClient()
  
  // Reuse heatmap logic: Get last 365 days of activity
  // This uses get_heatmap_data RPC which returns { date, count, level }
  // We can just fetch all heatmap data.
  const today = new Date()
  const oneYearAgo = new Date(today)
  oneYearAgo.setFullYear(today.getFullYear() - 1)
  
  const { data, error } = await supabase.rpc('get_heatmap_data', {
    start_date: oneYearAgo.toISOString()
  })
  
  if (error) {
    console.error('Error fetching calendar data:', error)
    return []
  }
  
  // Transform to ensure types are correct (BigInt -> Number)
  return (data || []).map((entry: any) => ({
    date: entry.date,
    count: Number(entry.count), // Ensure number
    level: Number(entry.level)
  }))
}

export async function getDayLogs(dateStr: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc('get_day_metrics_log', {
    target_date: dateStr
  })
  
  if (error) {
    console.error('Error fetching day logs:', error)
    return []
  }
  
  return data
}

export async function getHistoryStats(dateStr: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc('get_history_stats', {
    target_date: dateStr
  })
  
  if (error) {
    console.error('Error fetching history stats:', error)
    return null
  }
  
  return data
}
