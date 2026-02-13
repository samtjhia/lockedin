'use server'

import { createClient } from '@/utils/supabase/server'
import { getFriends } from '@/app/actions/social'

export type ProfileSummary = {
  id: string
  username: string | null
  avatar_url: string | null
  is_verified: boolean
  current_status: string | null
  current_task: string | null
}

export type ProfileGrades = {
  day: string
  week: string
  month: string
}

export type ProfileTopTask = {
  task_name: string
  total_seconds: number
}

export type ProfileHeatmapEntry = {
  date: string
  count: number
  level: number
}

export type UserProfileData = {
  profile: ProfileSummary
  isSelf: boolean
  isFriend: boolean
  grades: ProfileGrades
  heatmap: ProfileHeatmapEntry[]
  topTasksDaily: ProfileTopTask[]
  topTasksWeekly: ProfileTopTask[]
  historyStats: any
  friendsPreview: {
    id: string
    username: string
    avatar_url?: string | null
  }[]
}

function computeGrade(seconds: number): string {
  const minutes = seconds / 60

  if (minutes <= 0) return 'F'
  if (minutes < 30) return 'D'
  if (minutes < 60) return 'C'
  if (minutes < 120) return 'B'
  if (minutes < 240) return 'A'
  return 'S'
}

export async function getUserProfileData(slug: string): Promise<UserProfileData | null> {
  const supabase = await createClient()

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()

  if (!currentUser) return null

  // Normalize slug: if it's missing, default to current user.
  const effectiveSlug = slug || currentUser.id

  // Try to resolve by username first, then fall back to id.
  let profile: any | null = null
  let error: any = null

  const byUsername = await supabase
    .from('profiles')
    .select('id, username, avatar_url, is_verified, current_status, current_task')
    .eq('username', effectiveSlug)
    .maybeSingle()

  profile = byUsername.data
  error = byUsername.error

  if (!profile && !error) {
    const byId = await supabase
      .from('profiles')
      .select('id, username, avatar_url, is_verified, current_status, current_task')
      .eq('id', effectiveSlug)
      .maybeSingle()

    profile = byId.data
    error = byId.error
  }

  if (error || !profile) {
    console.error('Error fetching profile for slug', effectiveSlug, error)
    return null
  }

  const targetUserId = profile.id as string
  const isSelf = currentUser.id === targetUserId

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const oneYearAgo = new Date(today)
  oneYearAgo.setFullYear(today.getFullYear() - 1)

  const [historyStatsRes, heatmapRes, dailyTasksRes, weeklyTasksRes, friends] = await Promise.all([
    supabase.rpc('get_user_history_stats', {
      target_user_id: targetUserId,
      target_date: todayStr,
    }),
    supabase.rpc('get_user_heatmap_data', {
      target_user_id: targetUserId,
      start_date: oneYearAgo.toISOString(),
    }),
    supabase.rpc('get_user_top_tasks', {
      target_user_id: targetUserId,
      period: 'daily',
    }),
    supabase.rpc('get_user_top_tasks', {
      target_user_id: targetUserId,
      period: 'weekly',
    }),
    getFriends(),
  ])

  if (historyStatsRes.error) {
    console.error('Error fetching user history stats:', historyStatsRes.error)
  }
  if (heatmapRes.error) {
    console.error('Error fetching user heatmap:', heatmapRes.error)
  }
  if (dailyTasksRes.error) {
    console.error('Error fetching daily top tasks:', dailyTasksRes.error)
  }
  if (weeklyTasksRes.error) {
    console.error('Error fetching weekly top tasks:', weeklyTasksRes.error)
  }

  const historyStats = historyStatsRes.data ?? null
  const dailySeconds = historyStats?.daily?.total_seconds ?? 0
  const weeklySeconds = historyStats?.weekly?.total_seconds ?? 0
  const monthlySeconds = historyStats?.monthly?.total_seconds ?? 0

  const grades: ProfileGrades = {
    day: computeGrade(dailySeconds),
    week: computeGrade(weeklySeconds),
    month: computeGrade(monthlySeconds),
  }

  const heatmap: ProfileHeatmapEntry[] =
    (heatmapRes.data || []).map((entry: any) => ({
      date: entry.date,
      count: Number(entry.count),
      level: Number(entry.level),
    })) ?? []

  const topTasksDaily: ProfileTopTask[] =
    (dailyTasksRes.data || []).map((row: any) => ({
      task_name: row.task_name,
      total_seconds: Number(row.total_seconds),
    })) ?? []

  const topTasksWeekly: ProfileTopTask[] =
    (weeklyTasksRes.data || []).map((row: any) => ({
      task_name: row.task_name,
      total_seconds: Number(row.total_seconds),
    })) ?? []

  const friendsArray = (friends || []) as any[]
  const isFriend = !!friendsArray.find((f: any) => f.user_id === targetUserId)

  const friendsPreview =
    friendsArray.map((f: any) => ({
      id: f.user_id as string,
      username: f.username as string,
      avatar_url: f.avatar_url as string | null,
    })) ?? []

  return {
    profile: profile as ProfileSummary,
    isSelf,
    isFriend,
    grades,
    heatmap,
    topTasksDaily,
    topTasksWeekly,
    historyStats,
    friendsPreview,
  }
}

