import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { exchangeStravaCode, syncStravaForUser } from '@/lib/strava'

export async function GET(request: NextRequest) {
  const appBaseUrl = process.env.APP_BASE_URL?.trim() || request.nextUrl.origin
  const appUrl = (path: string) => new URL(path, appBaseUrl)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(appUrl('/login?next=/profile/edit'))
  }

  const code = request.nextUrl.searchParams.get('code')
  if (!code) {
    return NextResponse.redirect(appUrl('/profile/edit?strava=missing_code'))
  }

  const clientId = process.env.STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(appUrl('/profile/edit?strava=config_error'))
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
    const { data: profile } = await admin
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle()

    const slug = profile?.username || user.id
    return NextResponse.redirect(appUrl(`/profile/${encodeURIComponent(slug)}?view=health&strava=connected`))
  } catch (error) {
    console.error('Strava callback failed:', error)
    return NextResponse.redirect(appUrl('/profile?view=health&strava=connect_error'))
  }
}
