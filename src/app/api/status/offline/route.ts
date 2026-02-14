import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  await supabase
    .from('profiles')
    .update({ current_status: 'offline', updated_at: new Date().toISOString() })
    .eq('id', user.id)

  return NextResponse.json({ ok: true })
}
