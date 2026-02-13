import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EditProfileForm } from "@/components/profile/edit-profile-form"

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
    .select("id, username, avatar_url, bio, goals")
    .eq("id", user.id)
    .single()

  return { user, profile }
}

export default async function EditProfilePage() {
  const { user, profile } = await getCurrentProfile()

  return (
    <div className="max-w-xl mx-auto p-4 md:p-8">
      <Card className="bg-muted/60 border-border">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Edit profile</CardTitle>
        </CardHeader>
        <CardContent>
          <EditProfileForm
            username={profile?.username ?? ""}
            avatarUrl={profile?.avatar_url ?? null}
            bio={profile?.bio ?? ""}
            goals={profile?.goals ?? ""}
            initials={
              profile?.username?.substring(0, 2).toUpperCase() ??
              user.email?.substring(0, 2).toUpperCase() ??
              "YOU"
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
