import type { SupabaseClient } from '@supabase/supabase-js'

const STRAVA_API_BASE = 'https://www.strava.com/api/v3'
const STRAVA_OAUTH_TOKEN_URL = 'https://www.strava.com/oauth/token'
const STRAVA_OAUTH_AUTHORIZE_URL = 'https://www.strava.com/oauth/authorize'
const TOKEN_REFRESH_BUFFER_SECONDS = 120
const FALLBACK_SYNC_LOOKBACK_SECONDS = 14 * 24 * 60 * 60

export const DEFAULT_STRAVA_ACTIVITY_TYPES = [
  'RUN',
  'RIDE',
  'WALK',
  'HIKE',
  'SWIM',
  'WORKOUT',
  'WEIGHTTRAINING',
  'VIRTUALRIDE',
  'VIRTUALRUN',
] as const

export type StravaConnectionRow = {
  user_id: string
  athlete_id: number
  athlete_username: string | null
  athlete_name: string | null
  access_token: string
  refresh_token: string
  expires_at: string
  scope: string | null
  included_activity_types: string[] | null
  disconnected_at: string | null
}

type StravaAthlete = {
  id: number
  username?: string | null
  firstname?: string | null
  lastname?: string | null
}

type StravaTokenResponse = {
  token_type: string
  access_token: string
  refresh_token: string
  expires_at: number
  expires_in: number
  athlete: StravaAthlete
}

export type StravaActivity = {
  id: number
  name: string
  type: string
  start_date: string
  moving_time?: number
  elapsed_time: number
  distance?: number
  total_elevation_gain?: number
  average_speed?: number
  max_speed?: number
  kilojoules?: number
  calories?: number
  best_efforts?: Array<{
    name?: string
    elapsed_time?: number
    pr_rank?: number | null
    achievement_count?: number
    distance?: number
  }>
}

type SyncReason = 'manual' | 'connect' | 'webhook' | 'cron'

export type SyncResult = {
  imported: number
  skipped: number
  fetched: number
}

export function normalizeStravaActivityType(value: string): string {
  return value.trim().replace(/\s+/g, '').toUpperCase()
}

export function buildStravaAuthorizeUrl(params: {
  clientId: string
  redirectUri: string
  state: string
}): string {
  const url = new URL(STRAVA_OAUTH_AUTHORIZE_URL)
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('approval_prompt', 'auto')
  url.searchParams.set('scope', 'read,activity:read_all')
  url.searchParams.set('state', params.state)
  return url.toString()
}

async function stravaTokenRequest(body: URLSearchParams): Promise<StravaTokenResponse> {
  const response = await fetch(STRAVA_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Strava token request failed (${response.status}): ${text}`)
  }

  return (await response.json()) as StravaTokenResponse
}

export async function exchangeStravaCode(params: {
  code: string
  clientId: string
  clientSecret: string
}): Promise<StravaTokenResponse> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    code: params.code,
    grant_type: 'authorization_code',
  })
  return stravaTokenRequest(body)
}

export async function refreshStravaToken(params: {
  refreshToken: string
  clientId: string
  clientSecret: string
}): Promise<StravaTokenResponse> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: params.refreshToken,
  })
  return stravaTokenRequest(body)
}

async function fetchStravaActivities(params: {
  accessToken: string
  afterEpochSeconds: number
}): Promise<StravaActivity[]> {
  const activities: StravaActivity[] = []
  let page = 1

  while (page <= 10) {
    const url = new URL(`${STRAVA_API_BASE}/athlete/activities`)
    url.searchParams.set('after', String(params.afterEpochSeconds))
    url.searchParams.set('per_page', '100')
    url.searchParams.set('page', String(page))

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
      },
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Strava activities request failed (${response.status}): ${text}`)
    }

    const batch = (await response.json()) as StravaActivity[]
    if (!Array.isArray(batch) || batch.length === 0) break
    activities.push(...batch)

    if (batch.length < 100) break
    page += 1
  }

  return activities
}

async function fetchStravaActivityDetail(params: {
  accessToken: string
  activityId: number
}): Promise<StravaActivity> {
  const detailUrl = new URL(`${STRAVA_API_BASE}/activities/${params.activityId}`)
  detailUrl.searchParams.set('include_all_efforts', 'true')

  const response = await fetch(detailUrl.toString(), {
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Strava activity detail request failed (${response.status}): ${text}`)
  }

  return (await response.json()) as StravaActivity
}

function activityAllowed(activityType: string, allowedTypes: Set<string>): boolean {
  return allowedTypes.has(normalizeStravaActivityType(activityType))
}

function payloadHasBestEfforts(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false
  const bestEfforts = (payload as Record<string, unknown>).best_efforts
  return Array.isArray(bestEfforts) && bestEfforts.length > 0
}

function buildSessionTaskName(activity: StravaActivity): string {
  const normalizedType = activity.type?.trim() || 'Workout'
  const normalizedName = activity.name?.trim()
  if (!normalizedName) return normalizedType
  if (normalizedName.toLowerCase() === normalizedType.toLowerCase()) return normalizedType
  return `${normalizedType}: ${normalizedName}`
}

function activityEndedAtISO(startedAtISO: string, durationSeconds: number): string {
  const startMs = new Date(startedAtISO).getTime()
  return new Date(startMs + durationSeconds * 1000).toISOString()
}

async function ensureSyncStateRow(supabase: SupabaseClient, userId: string) {
  await supabase
    .from('strava_sync_state')
    .upsert({
      user_id: userId,
      updated_at: new Date().toISOString(),
    })
}

async function maybeRefreshConnectionToken(params: {
  supabase: SupabaseClient
  connection: StravaConnectionRow
  clientId: string
  clientSecret: string
}): Promise<StravaConnectionRow> {
  const expiresAtEpoch = Math.floor(new Date(params.connection.expires_at).getTime() / 1000)
  const nowEpoch = Math.floor(Date.now() / 1000)
  if (expiresAtEpoch > nowEpoch + TOKEN_REFRESH_BUFFER_SECONDS) {
    return params.connection
  }

  const refreshed = await refreshStravaToken({
    refreshToken: params.connection.refresh_token,
    clientId: params.clientId,
    clientSecret: params.clientSecret,
  })

  const updated = {
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token,
    expires_at: new Date(refreshed.expires_at * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await params.supabase
    .from('strava_connections')
    .update(updated)
    .eq('user_id', params.connection.user_id)
    .select(
      'user_id, athlete_id, athlete_username, athlete_name, access_token, refresh_token, expires_at, scope, included_activity_types, disconnected_at'
    )
    .single()

  if (error || !data) {
    throw new Error(`Failed to persist refreshed token: ${error?.message ?? 'unknown error'}`)
  }

  return data as StravaConnectionRow
}

export async function syncStravaForUser(params: {
  supabase: SupabaseClient
  userId: string
  reason: SyncReason
  lookbackSeconds?: number
}): Promise<SyncResult> {
  const clientId = process.env.STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET')
  }

  await ensureSyncStateRow(params.supabase, params.userId)

  const nowIso = new Date().toISOString()
  await params.supabase
    .from('strava_sync_state')
    .update({
      sync_in_progress: true,
      last_error_at: null,
      last_error_message: null,
      updated_at: nowIso,
    })
    .eq('user_id', params.userId)

  try {
    const { data: connection, error: connectionError } = await params.supabase
      .from('strava_connections')
      .select(
        'user_id, athlete_id, athlete_username, athlete_name, access_token, refresh_token, expires_at, scope, included_activity_types, disconnected_at'
      )
      .eq('user_id', params.userId)
      .is('disconnected_at', null)
      .maybeSingle()

    if (connectionError) throw new Error(connectionError.message)
    if (!connection) {
      await params.supabase
        .from('strava_sync_state')
        .update({
          sync_in_progress: false,
          last_synced_at: nowIso,
          updated_at: nowIso,
        })
        .eq('user_id', params.userId)
      return { imported: 0, skipped: 0, fetched: 0 }
    }

    const effectiveConnection = await maybeRefreshConnectionToken({
      supabase: params.supabase,
      connection: connection as StravaConnectionRow,
      clientId,
      clientSecret,
    })

    const { data: syncState } = await params.supabase
      .from('strava_sync_state')
      .select('last_success_at')
      .eq('user_id', params.userId)
      .maybeSingle()

    const nowEpoch = Math.floor(Date.now() / 1000)
    const fallbackAfter = nowEpoch - (params.lookbackSeconds ?? FALLBACK_SYNC_LOOKBACK_SECONDS)
    const lastSuccessEpoch = syncState?.last_success_at
      ? Math.floor(new Date(syncState.last_success_at).getTime() / 1000) - 3600
      : null
    // Manual sync should honor explicit lookback so it can backfill older activities and best efforts.
    const afterEpochSeconds =
      params.reason === 'manual'
        ? fallbackAfter
        : Math.max(fallbackAfter, lastSuccessEpoch ?? fallbackAfter)

    const activities = await fetchStravaActivities({
      accessToken: effectiveConnection.access_token,
      afterEpochSeconds,
    })

    const allowedTypes = new Set(
      (effectiveConnection.included_activity_types && effectiveConnection.included_activity_types.length > 0
        ? effectiveConnection.included_activity_types
        : [...DEFAULT_STRAVA_ACTIVITY_TYPES]
      ).map(normalizeStravaActivityType)
    )

    const filtered = activities.filter((activity) => activityAllowed(activity.type, allowedTypes))
    const activityIds = filtered.map((activity) => activity.id)

    let existingIds = new Set<number>()
    const existingById = new Map<
      number,
      {
        payload: unknown
        session_id: string | null
      }
    >()
    if (activityIds.length > 0) {
      const { data: existingRows } = await params.supabase
        .from('strava_activity_imports')
        .select('strava_activity_id, payload, session_id')
        .eq('user_id', params.userId)
        .in('strava_activity_id', activityIds)
      existingIds = new Set((existingRows ?? []).map((row: { strava_activity_id: number }) => row.strava_activity_id))
      for (const row of existingRows ?? []) {
        existingById.set(row.strava_activity_id as number, {
          payload: row.payload,
          session_id: (row as { session_id?: string | null }).session_id ?? null,
        })
      }
    }

    let imported = 0
    let skipped = 0

    for (const activity of filtered) {
      if (existingIds.has(activity.id)) {
        const existing = existingById.get(activity.id)
        if (existing && !payloadHasBestEfforts(existing.payload)) {
          try {
            const detail = await fetchStravaActivityDetail({
              accessToken: effectiveConnection.access_token,
              activityId: activity.id,
            })

            await params.supabase
              .from('strava_activity_imports')
              .update({
                payload: detail,
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', params.userId)
              .eq('strava_activity_id', activity.id)

            if (existing.session_id) {
              await params.supabase
                .from('sessions')
                .update({
                  source_payload: detail,
                  duration_seconds: Math.max(0, detail.elapsed_time || activity.elapsed_time || 0),
                })
                .eq('id', existing.session_id)
                .eq('user_id', params.userId)
            }
          } catch (detailBackfillError) {
            console.warn(`Failed to backfill detail for activity ${activity.id}:`, detailBackfillError)
          }
        }
        skipped += 1
        continue
      }

      let detailedActivity: StravaActivity = activity
      try {
        detailedActivity = await fetchStravaActivityDetail({
          accessToken: effectiveConnection.access_token,
          activityId: activity.id,
        })
      } catch (detailError) {
        console.warn(`Falling back to summary payload for activity ${activity.id}:`, detailError)
      }

      const startedAt = detailedActivity.start_date || activity.start_date
      const durationSeconds = Math.max(0, detailedActivity.elapsed_time || activity.elapsed_time || 0)
      const endedAt = activityEndedAtISO(startedAt, durationSeconds)
      const taskName = buildSessionTaskName(detailedActivity)

      const sessionInsert = {
        user_id: params.userId,
        task_name: taskName,
        mode: 'stopwatch',
        status: 'completed',
        domain: 'health',
        started_at: startedAt,
        ended_at: endedAt,
        duration_seconds: durationSeconds,
        source: 'strava',
        source_activity_id: String(activity.id),
        source_payload: detailedActivity,
      }

      const { data: session, error: sessionError } = await params.supabase
        .from('sessions')
        .insert(sessionInsert)
        .select('id')
        .single()

      if (sessionError) {
        if (sessionError.code === '23505') {
          skipped += 1
          continue
        }
        throw new Error(`Failed to insert imported session: ${sessionError.message}`)
      }

      const { error: importError } = await params.supabase
        .from('strava_activity_imports')
        .insert({
          user_id: params.userId,
          strava_activity_id: activity.id,
          activity_type: activity.type,
          started_at: startedAt,
          duration_seconds: durationSeconds,
          session_id: session.id,
          payload: detailedActivity,
          imported_at: new Date().toISOString(),
        })

      if (importError) {
        if (importError.code === '23505') {
          skipped += 1
          continue
        }
        throw new Error(`Failed to insert import ledger row: ${importError.message}`)
      }

      imported += 1
    }

    await params.supabase
      .from('strava_sync_state')
      .update({
        sync_in_progress: false,
        last_synced_at: nowIso,
        last_success_at: nowIso,
        last_error_at: null,
        last_error_message: null,
        ...(params.reason === 'webhook' ? { last_webhook_at: nowIso } : {}),
        updated_at: nowIso,
      })
      .eq('user_id', params.userId)

    return {
      imported,
      skipped,
      fetched: activities.length,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Strava sync error'
    const nowErrorIso = new Date().toISOString()
    await params.supabase
      .from('strava_sync_state')
      .update({
        sync_in_progress: false,
        last_synced_at: nowErrorIso,
        last_error_at: nowErrorIso,
        last_error_message: message,
        updated_at: nowErrorIso,
      })
      .eq('user_id', params.userId)
    throw error
  }
}
