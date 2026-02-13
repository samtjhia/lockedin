import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export default async function MyProfileRedirect() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single()

  const slug = profile?.username || user.id

  redirect(`/profile/${encodeURIComponent(slug)}`)
}

