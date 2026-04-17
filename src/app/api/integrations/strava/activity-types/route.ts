import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { DEFAULT_STRAVA_ACTIVITY_TYPES, normalizeStravaActivityType } from '@/lib/strava'

type Body = {
  activityTypes?: string[]
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as Body
  const normalized = Array.from(
    new Set((body.activityTypes ?? []).map((value) => normalizeStravaActivityType(value)).filter(Boolean))
  )

  const nextTypes = normalized.length > 0 ? normalized : [...DEFAULT_STRAVA_ACTIVITY_TYPES]
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('strava_connections')
    .update({
      included_activity_types: nextTypes,
      updated_at: now,
    })
    .eq('user_id', user.id)
    .is('disconnected_at', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, activityTypes: nextTypes })
}
