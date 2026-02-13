import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const formData = await request.formData()
  const username = (formData.get("username") as string | null)?.trim() || null

  await supabase
    .from("profiles")
    .update({ username })
    .eq("id", user.id)

  return NextResponse.redirect(new URL("/profile", request.url), {
    status: 303,
  })
}

