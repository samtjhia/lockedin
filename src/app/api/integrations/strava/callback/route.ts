import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { exchangeStravaCode, syncStravaForUser } from '@/lib/strava'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login?next=/profile/edit', request.url))
  }

  const code = request.nextUrl.searchParams.get('code')
  if (!code) {
    return NextResponse.redirect(new URL('/profile/edit?strava=missing_code', request.url))
  }

  const clientId = process.env.STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/profile/edit?strava=config_error', request.url))
  }

  try {
    const token = await exchangeStravaCode({
      code,
      clientId,
      clientSecret,
    })

    const admin = createAdminClient()
    const athleteName = [token.athlete.firstname, token.athlete.lastname].filter(Boolean).join(' ').trim() || null

    const { error: upsertError } = await admin
      .from('strava_connections')
      .upsert({
        user_id: user.id,
        athlete_id: token.athlete.id,
        athlete_username: token.athlete.username ?? null,
        athlete_name: athleteName,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: new Date(token.expires_at * 1000).toISOString(),
        scope: token.token_type ?? null,
        connected_at: new Date().toISOString(),
        disconnected_at: null,
        updated_at: new Date().toISOString(),
      })

    if (upsertError) {
      throw upsertError
    }

    await admin
      .from('strava_sync_state')
      .upsert({
        user_id: user.id,
        sync_in_progress: false,
        updated_at: new Date().toISOString(),
      })

    await syncStravaForUser({
      supabase: admin,
      userId: user.id,
      reason: 'connect',
      lookbackSeconds: 90 * 24 * 60 * 60,
    })

    return NextResponse.redirect(new URL('/profile/edit?strava=connected', request.url))
  } catch (error) {
    console.error('Strava callback failed:', error)
    return NextResponse.redirect(new URL('/profile/edit?strava=connect_error', request.url))
  }
}
