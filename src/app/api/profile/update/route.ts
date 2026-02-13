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
  const bio = (formData.get("bio") as string | null)?.trim() || null
  const goals = (formData.get("goals") as string | null)?.trim() || null
  const avatarFile = formData.get("avatar") as File | null

  const updateData: Record<string, any> = { username, bio, goals }

  // Handle avatar upload if a file was provided
  if (avatarFile && avatarFile.size > 0) {
    const fileExt = avatarFile.name.split(".").pop() || "png"
    const filePath = `${user.id}/avatar.${fileExt}`

    // Upload (upsert) into the avatars bucket
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, avatarFile, {
        cacheControl: "3600",
        upsert: true,
      })

    if (uploadError) {
      console.error("Avatar upload error:", uploadError)
    } else {
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath)

      updateData.avatar_url = publicUrl
    }
  }

  await supabase.from("profiles").update(updateData).eq("id", user.id)

  return NextResponse.redirect(new URL("/profile", request.url), {
    status: 303,
  })
}
