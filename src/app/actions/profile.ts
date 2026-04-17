'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import { calculateGrade } from '@/lib/utils'
import { type ViewMode } from '@/lib/view-mode'

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

export type MedalHistoryEntry = { date?: string; week_start?: string; rank: number }

export type MedalHistory = {
  daily: MedalHistoryEntry[]
  weekly: MedalHistoryEntry[]
}

export type HealthInsights = {
  generatedAtIso: string
  windowDays: number
  totalActivities: number
  totalMinutes: number
  totalDistanceKm: number
  totalElevationM: number
  favoriteActivityType: string | null
  runPaceMinPerKm: number | null
  rideSpeedKph: number | null
  walkPaceMinPerKm: number | null
  daily: {
    date: string
    minutes: number
    distanceKm: number
  }[]
  recent: {
    startedAt: string
    taskName: string
    activityType: string | null
    stravaActivityId: string | null
    durationMinutes: number
    distanceKm: number
    stravaActivityUrl: string | null
  }[]
  sessions: {
    startedAt: string
    taskName: string
    activityType: string
    description: string | null
    durationMinutes: number
    distanceKm: number
    elevationM: number
    paceMinPerKm: number | null
    speedKph: number | null
    movingTimeMinutes: number
    elapsedTimeMinutes: number
    calories: number | null
    topResults: {
      label: string
      elapsedSeconds: number
      prRank: number | null
    }[]
    stravaActivityId: string | null
    stravaActivityUrl: string | null
  }[]
  activityGroups: {
    activityType: string
    totalActivities: number
    totalMinutes: number
    totalDistanceKm: number
    averagePaceMinPerKm: number | null
    averageSpeedKph: number | null
    sessions: {
      startedAt: string
      taskName: string
      description: string | null
      durationMinutes: number
      distanceKm: number
      elevationM: number
      paceMinPerKm: number | null
      speedKph: number | null
      movingTimeMinutes: number
      elapsedTimeMinutes: number
      calories: number | null
      topResults: {
        label: string
        elapsedSeconds: number
        prRank: number | null
      }[]
      stravaActivityId: string | null
      stravaActivityUrl: string | null
    }[]
  }[]
  prs: {
    label: string
    value: string
    context: string
  }[]
  prGroups: {
    id: string
    label: string
    activityType: string
    items: {
      category: 'best-effort' | 'record'
      activityType: string
      label: string
      value: string
      context: string
    }[]
  }[]
  stravaProfileUrl: string | null
}

export type UserProfileData = {
  profile: ProfileSummary
  isSelf: boolean
  isFriend: boolean
  /** True when current user has already sent a pending friend request to this profile */
  hasPendingRequestToThem: boolean
  grades: ProfileGrades
  heatmap: ProfileHeatmapEntry[]
  topTasksDaily: ProfileTopTask[]
  topTasksWeekly: ProfileTopTask[]
  historyStats: any
  medalHistory: MedalHistory
  friendsPreview: {
    id: string
    username: string
    avatar_url?: string | null
  }[]
  stravaConnection: {
    athlete_id: number
    athlete_username: string | null
    athlete_name: string | null
    connected_at: string
    included_activity_types: string[] | null
  } | null
  stravaSyncState: {
    sync_in_progress: boolean
    last_synced_at: string | null
    last_success_at: string | null
    last_error_at: string | null
    last_error_message: string | null
  } | null
  healthInsights: HealthInsights | null
  stravaPublicProfile: {
    athlete_id: number
    athlete_username: string | null
    athlete_name: string | null
    strava_profile_url: string
  } | null
}

function readNumericField(payload: unknown, key: string): number {
  if (!payload || typeof payload !== 'object') return 0
  const value = (payload as Record<string, unknown>)[key]
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function readStringField(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== 'object') return null
  const value = (payload as Record<string, unknown>)[key]
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function isRunLikeType(activityType: string | null): boolean {
  return activityType === 'RUN' || activityType === 'VIRTUALRUN'
}

function isWalkLikeType(activityType: string | null): boolean {
  return activityType === 'WALK' || activityType === 'HIKE'
}

function isRideLikeType(activityType: string | null): boolean {
  return activityType === 'RIDE' || activityType === 'VIRTUALRIDE'
}

function canonicalizeBestEffortLabel(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ')
  const compact = normalized.replace(/\s+/g, '')

  if (compact === '400m' || compact === '400meter' || compact === '400meters') return '400m'
  if (compact === '1k' || compact === '1km' || compact === '1000m' || compact === '1kilometer' || compact === '1kilometre') return '1k'
  if (
    compact === '1/2mile' ||
    compact === '0.5mile' ||
    compact === 'halfmile' ||
    compact === 'half-mile'
  ) {
    return '1/2 mile'
  }
  if (compact === '1mile' || compact === 'mile') return '1 mile'
  if (compact === '5k' || compact === '5km' || compact === '5000m' || compact === '5kilometer' || compact === '5kilometre') return '5k'
  if (compact === '10k' || compact === '10km' || compact === '10000m' || compact === '10kilometer' || compact === '10kilometre') return '10k'

  return normalized
}

function readBestEfforts(payload: unknown): {
  label: string
  elapsedSeconds: number
  prRank: number | null
}[] {
  if (!payload || typeof payload !== 'object') return []
  const raw = (payload as Record<string, unknown>).best_efforts
  if (!Array.isArray(raw)) return []

  const preferred = ['400m', '1k', '1/2 mile', '1 mile', '5k', '10k']
  const mapped = raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const row = entry as Record<string, unknown>
      const label = typeof row.name === 'string' ? row.name : null
      const elapsed = typeof row.elapsed_time === 'number' ? row.elapsed_time : Number(row.elapsed_time ?? NaN)
      const prRank =
        typeof row.pr_rank === 'number'
          ? row.pr_rank
          : row.pr_rank == null
          ? null
          : Number.isFinite(Number(row.pr_rank))
          ? Number(row.pr_rank)
          : null

      if (!label || !Number.isFinite(elapsed) || elapsed <= 0) return null
      return {
        label: canonicalizeBestEffortLabel(label),
        elapsedSeconds: Math.round(elapsed),
        prRank,
      }
    })
    .filter(Boolean) as { label: string; elapsedSeconds: number; prRank: number | null }[]

  const preferredMapped = preferred
    .map((p) => mapped.find((m) => m.label === p))
    .filter(Boolean) as { label: string; elapsedSeconds: number; prRank: number | null }[]

  const fallback = mapped
    .filter((m) => !preferred.includes(m.label))
    .sort((a, b) => a.elapsedSeconds - b.elapsedSeconds)
    .slice(0, Math.max(0, 6 - preferredMapped.length))

  return [...preferredMapped, ...fallback].slice(0, 6).map((entry) => ({
    label: entry.label,
    elapsedSeconds: entry.elapsedSeconds,
    prRank: entry.prRank,
  }))
}

export async function getUserProfileData(slug: string, viewMode: ViewMode = 'all'): Promise<UserProfileData | null> {
  const supabase = await createClient()
  const admin = createAdminClient()

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

  const healthWindowStart = new Date(today)
  healthWindowStart.setDate(today.getDate() - 364)

  const [historyStatsRes, heatmapRes, dailyTasksRes, weeklyTasksRes, targetFriendsRes, myFriendsRes, pendingOutgoingRes, medalHistoryRes, stravaConnectionRes, stravaSyncStateRes, healthSessionsRes, stravaPublicRes, prImportsRes] = await Promise.all([
    supabase.rpc('get_user_history_stats', {
      target_user_id: targetUserId,
      target_date: todayStr,
      view_mode: viewMode,
    }),
    supabase.rpc('get_user_heatmap_data', {
      target_user_id: targetUserId,
      start_date: oneYearAgo.toISOString(),
      view_mode: viewMode,
    }),
    supabase.rpc('get_user_top_tasks', {
      target_user_id: targetUserId,
      period: 'daily',
      view_mode: viewMode,
    }),
    supabase.rpc('get_user_top_tasks', {
      target_user_id: targetUserId,
      period: 'weekly',
      view_mode: viewMode,
    }),
    supabase.rpc('get_user_friends', { target_user_id: targetUserId }),
    supabase.rpc('get_friends'),
    !isSelf
      ? supabase
          .from('friendships')
          .select('id')
          .eq('requester_id', currentUser.id)
          .eq('recipient_id', targetUserId)
          .eq('status', 'pending')
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.rpc('get_user_medal_history', {
      target_user_id: targetUserId,
      weeks_back: 6,
      view_mode: viewMode,
    }),
    isSelf
      ? supabase
          .from('strava_connections')
          .select('athlete_id, athlete_username, athlete_name, connected_at, included_activity_types, disconnected_at')
          .eq('user_id', targetUserId)
          .is('disconnected_at', null)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    isSelf
      ? supabase
          .from('strava_sync_state')
          .select('sync_in_progress, last_synced_at, last_success_at, last_error_at, last_error_message')
          .eq('user_id', targetUserId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    admin
      .from('sessions')
      .select('task_name, started_at, duration_seconds, source_activity_id, source_payload')
      .eq('user_id', targetUserId)
      .eq('domain', 'health')
      .eq('status', 'completed')
      .eq('source', 'strava')
      .gte('started_at', healthWindowStart.toISOString())
      .order('started_at', { ascending: false })
      .limit(1000),
    admin
      .from('strava_connections')
      .select('athlete_id, athlete_username, athlete_name')
      .eq('user_id', targetUserId)
      .is('disconnected_at', null)
      .maybeSingle(),
    admin
      .from('strava_activity_imports')
      .select('started_at, activity_type, payload')
      .eq('user_id', targetUserId)
      .order('started_at', { ascending: false })
      .limit(1000),
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

  const hasPendingRequestToThem = !isSelf && !!pendingOutgoingRes.data

  const rawMedal = medalHistoryRes.data as { daily?: { date?: string; rank: number }[]; weekly?: { week_start?: string; rank: number }[] } | null
  const medalHistory: MedalHistory = {
    daily: Array.isArray(rawMedal?.daily) ? rawMedal.daily.map((e: any) => ({ date: e.date, rank: Number(e.rank) })) : [],
    weekly: Array.isArray(rawMedal?.weekly) ? rawMedal.weekly.map((e: any) => ({ week_start: e.week_start, rank: Number(e.rank) })) : [],
  }

  const stravaConnection = stravaConnectionRes.data
    ? {
        athlete_id: Number(stravaConnectionRes.data.athlete_id),
        athlete_username: stravaConnectionRes.data.athlete_username as string | null,
        athlete_name: stravaConnectionRes.data.athlete_name as string | null,
        connected_at: stravaConnectionRes.data.connected_at as string,
        included_activity_types: (stravaConnectionRes.data.included_activity_types as string[] | null) ?? null,
      }
    : null

  const stravaSyncState = stravaSyncStateRes.data
    ? {
        sync_in_progress: Boolean(stravaSyncStateRes.data.sync_in_progress),
        last_synced_at: stravaSyncStateRes.data.last_synced_at as string | null,
        last_success_at: stravaSyncStateRes.data.last_success_at as string | null,
        last_error_at: stravaSyncStateRes.data.last_error_at as string | null,
        last_error_message: stravaSyncStateRes.data.last_error_message as string | null,
      }
    : null

  const stravaPublicProfile = stravaPublicRes.data
    ? {
        athlete_id: Number(stravaPublicRes.data.athlete_id),
        athlete_username: stravaPublicRes.data.athlete_username as string | null,
        athlete_name: stravaPublicRes.data.athlete_name as string | null,
        strava_profile_url: `https://www.strava.com/athletes/${Number(stravaPublicRes.data.athlete_id)}`,
      }
    : null

  let healthInsights: HealthInsights | null = null
  {
    const rows = (healthSessionsRes.data ?? []) as {
      task_name: string
      started_at: string
      duration_seconds: number | null
      source_activity_id: string | null
      source_payload: unknown
    }[]

    const dailyMap = new Map<string, { date: string; minutes: number; distanceKm: number }>()
    const typeCounts = new Map<string, number>()
    const allSessions: HealthInsights['sessions'] = []
    let totalMinutes = 0
    let totalDistanceKm = 0
    let totalElevationM = 0
    let runPaceMinutesSum = 0
    let runPaceSamples = 0
    let walkPaceMinutesSum = 0
    let walkPaceSamples = 0
    let rideSpeedKphSum = 0
    let rideSpeedSamples = 0

    const groups = new Map<
      string,
      {
        activityType: string
        totalActivities: number
        totalMinutes: number
        totalDistanceKm: number
        paceMinutesSum: number
        paceSamples: number
        speedKphSum: number
        speedSamples: number
        sessions: {
          startedAt: string
          taskName: string
          description: string | null
          durationMinutes: number
          distanceKm: number
          elevationM: number
          paceMinPerKm: number | null
          speedKph: number | null
          movingTimeMinutes: number
          elapsedTimeMinutes: number
          calories: number | null
          topResults: {
            label: string
            elapsedSeconds: number
            prRank: number | null
          }[]
          stravaActivityId: string | null
          stravaActivityUrl: string | null
        }[]
      }
    >()

    const recent = rows.slice(0, 12).map((row) => {
      const durationMinutes = Math.round((Number(row.duration_seconds ?? 0) / 60) * 10) / 10
      const distanceKm = readNumericField(row.source_payload, 'distance') / 1000
      const activityType = readStringField(row.source_payload, 'type')
      const description = readStringField(row.source_payload, 'description')
      const stravaActivityId = row.source_activity_id ?? null
      return {
        startedAt: row.started_at,
        taskName: row.task_name,
        activityType,
        description,
        stravaActivityId,
        durationMinutes,
        distanceKm: Math.round(distanceKm * 100) / 100,
        stravaActivityUrl: stravaActivityId ? `https://www.strava.com/activities/${stravaActivityId}` : null,
      }
    })

    for (const row of rows) {
      const durationSeconds = Number(row.duration_seconds ?? 0)
      const minutes = durationSeconds / 60
      totalMinutes += minutes

      const distanceKm = readNumericField(row.source_payload, 'distance') / 1000
      const elevationM = readNumericField(row.source_payload, 'total_elevation_gain')
      totalDistanceKm += distanceKm
      totalElevationM += elevationM

      const activityType = readStringField(row.source_payload, 'type')
      const movingTimeSeconds = readNumericField(row.source_payload, 'moving_time')
      const elapsedTimeSeconds = readNumericField(row.source_payload, 'elapsed_time') || durationSeconds
      const caloriesRaw = readNumericField(row.source_payload, 'calories')
      const paceMinPerKm =
        movingTimeSeconds > 0 && distanceKm > 0 ? movingTimeSeconds / 60 / distanceKm : null
      const speedKph =
        movingTimeSeconds > 0 && distanceKm > 0 ? distanceKm / (movingTimeSeconds / 3600) : null
      const topResults = readBestEfforts(row.source_payload)

      if (paceMinPerKm != null && isRunLikeType(activityType)) {
        runPaceMinutesSum += paceMinPerKm
        runPaceSamples += 1
      }
      if (paceMinPerKm != null && isWalkLikeType(activityType)) {
        walkPaceMinutesSum += paceMinPerKm
        walkPaceSamples += 1
      }
      if (speedKph != null && isRideLikeType(activityType)) {
        rideSpeedKphSum += speedKph
        rideSpeedSamples += 1
      }
      if (activityType) {
        typeCounts.set(activityType, (typeCounts.get(activityType) ?? 0) + 1)
      }

      const groupKey = activityType ?? 'OTHER'
      const description = readStringField(row.source_payload, 'description')
      const durationMinutes = Math.round((durationSeconds / 60) * 10) / 10
      const sourceActivityId = row.source_activity_id ?? null
      const existingGroup = groups.get(groupKey) ?? {
        activityType: groupKey,
        totalActivities: 0,
        totalMinutes: 0,
        totalDistanceKm: 0,
        paceMinutesSum: 0,
        paceSamples: 0,
        speedKphSum: 0,
        speedSamples: 0,
        sessions: [],
      }
      existingGroup.totalActivities += 1
      existingGroup.totalMinutes += durationMinutes
      existingGroup.totalDistanceKm += distanceKm
      if (paceMinPerKm != null) {
        existingGroup.paceMinutesSum += paceMinPerKm
        existingGroup.paceSamples += 1
      }
      if (speedKph != null) {
        existingGroup.speedKphSum += speedKph
        existingGroup.speedSamples += 1
      }
      const sessionEntry = {
        startedAt: row.started_at,
        taskName: row.task_name,
        description,
        durationMinutes,
        distanceKm: Math.round(distanceKm * 100) / 100,
        elevationM: Math.round(elevationM),
        paceMinPerKm: paceMinPerKm != null ? Math.round(paceMinPerKm * 100) / 100 : null,
        speedKph: speedKph != null ? Math.round(speedKph * 100) / 100 : null,
        movingTimeMinutes: Math.round((movingTimeSeconds / 60) * 10) / 10,
        elapsedTimeMinutes: Math.round((elapsedTimeSeconds / 60) * 10) / 10,
        calories: caloriesRaw > 0 ? Math.round(caloriesRaw) : null,
        topResults,
        stravaActivityId: sourceActivityId,
        stravaActivityUrl: sourceActivityId ? `https://www.strava.com/activities/${sourceActivityId}` : null,
      }
      existingGroup.sessions.push(sessionEntry)
      allSessions.push({
        ...sessionEntry,
        activityType: groupKey,
      })
      groups.set(groupKey, existingGroup)

      const date = new Date(row.started_at).toISOString().slice(0, 10)
      const existing = dailyMap.get(date) ?? { date, minutes: 0, distanceKm: 0 }
      existing.minutes += minutes
      existing.distanceKm += distanceKm
      dailyMap.set(date, existing)
    }

    const favoriteActivityType =
      [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

    const daily = [...dailyMap.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((entry) => ({
        date: entry.date,
        minutes: Math.round(entry.minutes * 10) / 10,
        distanceKm: Math.round(entry.distanceKm * 100) / 100,
      }))

    const activityGroups = [...groups.values()]
      .map((group) => ({
        activityType: group.activityType,
        totalActivities: group.totalActivities,
        totalMinutes: Math.round(group.totalMinutes),
        totalDistanceKm: Math.round(group.totalDistanceKm * 100) / 100,
        averagePaceMinPerKm:
          group.paceSamples > 0 ? Math.round((group.paceMinutesSum / group.paceSamples) * 100) / 100 : null,
        averageSpeedKph:
          group.speedSamples > 0 ? Math.round((group.speedKphSum / group.speedSamples) * 100) / 100 : null,
        sessions: group.sessions
          .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
          .slice(0, 15),
      }))
      .sort((a, b) => b.totalActivities - a.totalActivities)

    const byDistance = rows
      .map((row) => ({
        meters: readNumericField(row.source_payload, 'distance'),
        startedAt: row.started_at,
        type: readStringField(row.source_payload, 'type') ?? 'Workout',
      }))
      .sort((a, b) => b.meters - a.meters)[0]

    const byDuration = rows
      .map((row) => ({
        seconds: Number(row.duration_seconds ?? 0),
        startedAt: row.started_at,
        type: readStringField(row.source_payload, 'type') ?? 'Workout',
      }))
      .sort((a, b) => b.seconds - a.seconds)[0]

    const byElevation = rows
      .map((row) => ({
        meters: readNumericField(row.source_payload, 'total_elevation_gain'),
        startedAt: row.started_at,
        type: readStringField(row.source_payload, 'type') ?? 'Workout',
      }))
      .sort((a, b) => b.meters - a.meters)[0]

    const runLikeRows = rows
      .map((row) => {
        const activityType = readStringField(row.source_payload, 'type')
        const distanceKm = readNumericField(row.source_payload, 'distance') / 1000
        const movingTime = readNumericField(row.source_payload, 'moving_time')
        const pace = distanceKm > 0 && movingTime > 0 ? movingTime / 60 / distanceKm : Number.POSITIVE_INFINITY
        return {
          row,
          activityType,
          distanceKm,
          movingTime,
          pace,
        }
      })
      .filter((entry) => isRunLikeType(entry.activityType) && Number.isFinite(entry.pace))

    const formatDate = (value: string) =>
      new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    const bestRunPace = runLikeRows.sort((a, b) => a.pace - b.pace)[0]
    const preferredBestEffortLabels = ['400m', '1k', '1/2 mile', '1 mile', '5k', '10k']
    const bestEffortsByLabel = new Map<
      string,
      {
        elapsedSeconds: number
        startedAt: string
        activityType: string
      }
    >()

    const prRows = (prImportsRes.data ?? []) as {
      started_at: string
      activity_type: string
      payload: unknown
    }[]

    for (const row of prRows) {
      const efforts = readBestEfforts(row.payload)
      for (const rawEffort of efforts) {
        const effort = {
          ...rawEffort,
          label: rawEffort.label.toLowerCase().trim(),
        }
        if (!preferredBestEffortLabels.includes(effort.label)) continue
        const existing = bestEffortsByLabel.get(effort.label)
        if (!existing || effort.elapsedSeconds < existing.elapsedSeconds) {
          bestEffortsByLabel.set(effort.label, {
            elapsedSeconds: effort.elapsedSeconds,
            startedAt: row.started_at,
            activityType: row.activity_type || 'Workout',
          })
        }
      }
    }

    const formatElapsedSeconds = (seconds: number): string => {
      const mins = Math.floor(seconds / 60)
      const secs = seconds % 60
      return `${mins}:${String(secs).padStart(2, '0')}`
    }

    const bestEffortPrs = preferredBestEffortLabels
      .map((label) => {
        const effort = bestEffortsByLabel.get(label)
        if (!effort) return null
        const effortLabel =
          label === '1k' ? '1K' :
          label === '5k' ? '5K' :
          label === '10k' ? '10K' :
          label === '1/2 mile' ? '1/2 mile' :
          label
        return {
          category: 'best-effort' as const,
          activityType: effort.activityType,
          label: effortLabel,
          value: formatElapsedSeconds(effort.elapsedSeconds),
          context: `${effort.activityType} • ${formatDate(effort.startedAt)}`,
        }
      })
      .filter(Boolean) as { category: 'best-effort'; activityType: string; label: string; value: string; context: string }[]

    const fallbackPrs = [
      byDistance
        ? {
            category: 'record' as const,
            activityType: byDistance.type,
            label: 'Longest distance',
            value: `${(byDistance.meters / 1000).toFixed(2)} km`,
            context: `${byDistance.type} • ${formatDate(byDistance.startedAt)}`,
          }
        : null,
      byDuration
        ? {
            category: 'record' as const,
            activityType: byDuration.type,
            label: 'Longest duration',
            value: `${Math.round(byDuration.seconds / 60)} min`,
            context: `${byDuration.type} • ${formatDate(byDuration.startedAt)}`,
          }
        : null,
      byElevation && byElevation.meters > 0
        ? {
            category: 'record' as const,
            activityType: byElevation.type,
            label: 'Most elevation',
            value: `${Math.round(byElevation.meters)} m`,
            context: `${byElevation.type} • ${formatDate(byElevation.startedAt)}`,
          }
        : null,
      bestRunPace
        ? {
            category: 'record' as const,
            activityType: bestRunPace.activityType ?? 'RUN',
            label: 'Fastest run pace',
            value: `${Math.floor(bestRunPace.pace)}:${String(Math.round((bestRunPace.pace - Math.floor(bestRunPace.pace)) * 60)).padStart(2, '0')} /km`,
            context: `${bestRunPace.activityType} • ${formatDate(bestRunPace.row.started_at)}`,
          }
        : null,
    ].filter(Boolean) as {
      category: 'record'
      activityType: string
      label: string
      value: string
      context: string
    }[]

    const prs = bestEffortPrs.length > 0 ? [...bestEffortPrs, ...fallbackPrs] : fallbackPrs
    const prItems = bestEffortPrs.length > 0 ? [...bestEffortPrs, ...fallbackPrs] : fallbackPrs
    const prByActivity = new Map<string, typeof prItems>()
    for (const item of prItems) {
      const key = item.activityType || 'OTHER'
      const existing = prByActivity.get(key) ?? []
      existing.push(item)
      prByActivity.set(key, existing)
    }
    const prGroups = Array.from(prByActivity.entries())
      .map(([activityType, items]) => ({
        id: `activity-${activityType.toLowerCase().replace(/\s+/g, '-')}`,
        label: activityType,
        activityType,
        items,
      }))
      .sort((a, b) => b.items.length - a.items.length)

    healthInsights = {
      generatedAtIso: today.toISOString(),
      windowDays: 365,
      totalActivities: rows.length,
      totalMinutes: Math.round(totalMinutes),
      totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
      totalElevationM: Math.round(totalElevationM),
      favoriteActivityType,
      runPaceMinPerKm: runPaceSamples > 0 ? Math.round((runPaceMinutesSum / runPaceSamples) * 100) / 100 : null,
      rideSpeedKph: rideSpeedSamples > 0 ? Math.round((rideSpeedKphSum / rideSpeedSamples) * 100) / 100 : null,
      walkPaceMinPerKm: walkPaceSamples > 0 ? Math.round((walkPaceMinutesSum / walkPaceSamples) * 100) / 100 : null,
      daily,
      recent,
      sessions: allSessions,
      activityGroups,
      prs,
      prGroups,
      stravaProfileUrl: stravaPublicProfile?.strava_profile_url ?? null,
    }
  }

  return {
    profile: profile as ProfileSummary,
    isSelf,
    isFriend,
    hasPendingRequestToThem,
    grades,
    heatmap,
    topTasksDaily,
    topTasksWeekly,
    historyStats,
    medalHistory,
    friendsPreview,
    stravaConnection,
    stravaSyncState,
    healthInsights,
    stravaPublicProfile,
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

