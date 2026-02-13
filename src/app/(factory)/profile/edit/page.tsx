import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

async function getCurrentProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .eq("id", user.id)
    .single()

  return { user, profile }
}

export default async function EditProfilePage() {
  const { user, profile } = await getCurrentProfile()

  const initials =
    profile?.username?.substring(0, 2).toUpperCase() ??
    user.email?.substring(0, 2).toUpperCase() ??
    "YOU"

  return (
    <div className="max-w-xl mx-auto p-4 md:p-8">
      <Card className="bg-zinc-950/60 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-100">Edit profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 border border-zinc-700">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="text-xs text-zinc-500">
              Avatar uploads can be wired later using the existing{" "}
              <code className="font-mono text-[11px]">avatars</code> storage bucket.
            </div>
          </div>

          <form
            action="/api/profile/update"
            method="post"
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label
                htmlFor="username"
                className="text-xs font-medium text-zinc-400"
              >
                Display name
              </label>
              <Input
                id="username"
                name="username"
                defaultValue={profile?.username ?? ""}
                placeholder="Your display name"
                className="bg-zinc-900/60 border-zinc-800"
              />
              <p className="text-[11px] text-zinc-500">
                This is how your name appears on your profile and leaderboard.
              </p>
            </div>

            <Button type="submit" className="w-full">
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

