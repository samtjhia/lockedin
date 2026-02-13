import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"

export default async function LogoutPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await supabase.from('profiles').update({ current_status: 'offline' }).eq('id', user.id)
  }
  await supabase.auth.signOut()
  redirect("/login")
}

