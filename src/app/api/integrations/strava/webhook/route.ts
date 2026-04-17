import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { syncStravaForUser } from '@/lib/strava'

type StravaWebhookPayload = {
  object_type?: string
  object_id?: number
  aspect_type?: string
  owner_id?: number
  event_time?: number
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode')
  const challenge = request.nextUrl.searchParams.get('hub.challenge')
  const verifyToken = request.nextUrl.searchParams.get('hub.verify_token')
  const expectedVerifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN

  if (!expectedVerifyToken) {
    return NextResponse.json({ error: 'Missing STRAVA_WEBHOOK_VERIFY_TOKEN' }, { status: 500 })
  }

  if (mode === 'subscribe' && challenge && verifyToken === expectedVerifyToken) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Invalid webhook verification request' }, { status: 400 })
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => ({}))) as StravaWebhookPayload
  const admin = createAdminClient()

  const athleteId = payload.owner_id ?? null
  const createdAtIso = new Date().toISOString()
  const eventTimeIso = payload.event_time ? new Date(payload.event_time * 1000).toISOString() : null

  const { data: eventRow, error: insertError } = await admin
    .from('strava_webhook_events')
    .insert({
      athlete_id: athleteId,
      object_type: payload.object_type ?? null,
      object_id: payload.object_id ?? null,
      aspect_type: payload.aspect_type ?? null,
      event_time: eventTimeIso,
      payload,
      created_at: createdAtIso,
    })
    .select('id')
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  try {
    if (athleteId && payload.object_type === 'activity') {
      const { data: connections, error: lookupError } = await admin
        .from('strava_connections')
        .select('user_id')
        .eq('athlete_id', athleteId)
        .is('disconnected_at', null)

      if (lookupError) {
        throw lookupError
      }

      for (const connection of connections ?? []) {
        await syncStravaForUser({
          supabase: admin,
          userId: connection.user_id,
          reason: 'webhook',
          lookbackSeconds: 7 * 24 * 60 * 60,
        })
      }
    }

    await admin
      .from('strava_webhook_events')
      .update({ processed_at: new Date().toISOString(), processing_error: null })
      .eq('id', eventRow.id)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process webhook event'
    await admin
      .from('strava_webhook_events')
      .update({ processing_error: message })
      .eq('id', eventRow.id)
  }

  return NextResponse.json({ ok: true })
}
