import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  // Don't set offline if user has an active or paused session (e.g. refresh while focusing)
  const { data: session } = await supabase
    .from('sessions')
    .select('status')
    .eq('user_id', user.id)
    .in('status', ['active', 'paused'])
    .order('last_resumed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (session?.status === 'active' || session?.status === 'paused') {
    return NextResponse.json({ ok: true })
  }

  await supabase
    .from('profiles')
    .update({ current_status: 'offline', updated_at: new Date().toISOString() })
    .eq('id', user.id)

  return NextResponse.json({ ok: true })
}
