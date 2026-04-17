import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date().toISOString()
  const { error: connectionError } = await supabase
    .from('strava_connections')
    .update({
      disconnected_at: now,
      updated_at: now,
    })
    .eq('user_id', user.id)

  if (connectionError) {
    return NextResponse.json({ error: connectionError.message }, { status: 500 })
  }

  await supabase
    .from('strava_sync_state')
    .upsert({
      user_id: user.id,
      sync_in_progress: false,
      updated_at: now,
    })

  return NextResponse.json({ ok: true })
}
