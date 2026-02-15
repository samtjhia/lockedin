'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { calculateGrade } from '@/lib/utils'

export type ProfileSummary = {
  id: string
  username: string | null
  avatar_url: string | null
  bio: string | null
  goals: string | null
  is_verified: boolean
  current_status: string | null
  current_task: string | null
  updated_at: string | null
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

  const selectFields = 'id, username, avatar_url, is_verified, current_status, current_task, bio, goals, hidden_at, updated_at'

  async function queryProfile(column: string, value: string) {
    const res = await supabase
      .from('profiles')
      .select(selectFields)
      .eq(column, value)
      .maybeSingle()

    return res
  }

  const byUsername = await queryProfile('username', effectiveSlug)
  profile = byUsername.data
  error = byUsername.error

  if (!profile && !error) {
    const byId = await queryProfile('id', effectiveSlug)
    profile = byId.data
    error = byId.error
  }

  if (error || !profile) {
    console.error('Error fetching profile for slug', effectiveSlug, error)
    return null
  }

  const targetUserId = profile.id as string
  const isSelf = currentUser.id === targetUserId

  // Hidden profiles are not viewable by others (test accounts, etc.)
  if (!isSelf && profile.hidden_at) {
    return null
  }

  const today = new Date()
  // Use Toronto date so "Today" grade/times match get_user_history_stats (which uses America/Toronto)
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
  const oneYearAgo = new Date(today)
  oneYearAgo.setFullYear(today.getFullYear() - 1)

  const [historyStatsRes, heatmapRes, dailyTasksRes, weeklyTasksRes, targetFriendsRes, myFriendsRes] = await Promise.all([
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
    supabase.rpc('get_user_friends', { target_user_id: targetUserId }),
    supabase.rpc('get_friends'),
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
    day: calculateGrade(dailySeconds, 'daily'),
    week: calculateGrade(weeklySeconds, 'weekly'),
    month: calculateGrade(monthlySeconds, 'monthly'),
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

  // Target user's friends (for display on their profile)
  const targetFriendsArray = (targetFriendsRes.data || []) as any[]
  const friendsPreview = targetFriendsArray.map((f: any) => ({
    id: f.user_id as string,
    username: f.username as string,
    avatar_url: f.avatar_url as string | null,
  }))

  // Current user's friends (to check if target is a friend)
  const myFriendsArray = (myFriendsRes.data || []) as any[]
  const isFriend = !!myFriendsArray.find((f: any) => f.user_id === targetUserId)

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

export async function setProfileHidden(hidden: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('profiles')
    .update({ hidden_at: hidden ? new Date().toISOString() : null })
    .eq('id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/profile')
  revalidatePath('/profile/edit')
  revalidatePath('/')
  return { success: true }
}

