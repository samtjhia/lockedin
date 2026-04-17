import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { buildStravaAuthorizeUrl } from '@/lib/strava'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const clientId = process.env.STRAVA_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'Missing STRAVA_CLIENT_ID' }, { status: 500 })
  }

  const baseUrl = process.env.APP_BASE_URL || new URL(request.url).origin
  const redirectUri = `${baseUrl}/api/integrations/strava/callback`
  const state = `${user.id}:${Date.now()}`

  const url = buildStravaAuthorizeUrl({
    clientId,
    redirectUri,
    state,
  })

  return NextResponse.redirect(url)
}
