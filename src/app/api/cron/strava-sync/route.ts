import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { syncStravaForUser } from '@/lib/strava'

const FALLBACK_INTERVAL_MINUTES = 30

export async function POST() {
  const admin = createAdminClient()
  const now = Date.now()
  const staleThreshold = new Date(now - FALLBACK_INTERVAL_MINUTES * 60 * 1000).toISOString()

  const { data: rows, error } = await admin
    .from('strava_connections')
    .select(
      'user_id, disconnected_at, strava_sync_state(last_success_at, sync_in_progress)'
    )
    .is('disconnected_at', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let attempted = 0
  let synced = 0
  let failed = 0

  for (const row of rows ?? []) {
    const syncState = Array.isArray(row.strava_sync_state) ? row.strava_sync_state[0] : row.strava_sync_state
    const isInProgress = Boolean(syncState?.sync_in_progress)
    const lastSuccessAt = syncState?.last_success_at as string | null

    if (isInProgress) continue
    if (lastSuccessAt && lastSuccessAt > staleThreshold) continue

    attempted += 1
    try {
      await syncStravaForUser({
        supabase: admin,
        userId: row.user_id as string,
        reason: 'cron',
      })
      synced += 1
    } catch {
      failed += 1
    }
  }

  return NextResponse.json({
    ok: true,
    attempted,
    synced,
    failed,
  })
}
