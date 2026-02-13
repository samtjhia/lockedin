import { notFound } from 'next/navigation'
import { getUserProfileData } from '@/app/actions/profile'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { HeatMap } from '@/components/dashboard/stats/heat-map'
import { Target } from 'lucide-react'
import { PokeButton } from '@/components/profile/poke-button'

type ProfilePageProps = {
  params: Promise<{
    slug: string
  }>
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { slug } = await params
  const data = await getUserProfileData(slug)

  if (!data) {
    notFound()
  }

  const {
    profile,
    isSelf,
    isFriend,
    grades,
    heatmap,
    topTasksDaily,
    topTasksWeekly,
    historyStats,
    friendsPreview,
  } = data!

  const initials =
    profile.username?.substring(0, 2).toUpperCase() ||
    (profile.id ? profile.id.substring(0, 2).toUpperCase() : '?')

  const formatSeconds = (seconds: number) => {
    const rounded = Math.round(seconds)
    const h = Math.floor(rounded / 3600)
    const m = Math.floor((rounded % 3600) / 60)
    const s = rounded % 60

    if (h > 0) return `${h}h ${m}m ${s}s`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-4">
      {/* Identity header — goals integrated */}
      <Card className="bg-muted/60 border-border">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <Avatar className="h-20 w-20 border border-border shrink-0">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-semibold text-foreground">
                    {profile.username || 'Unknown user'}
                  </h1>
                  {profile.is_verified && (
                    <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/40 text-xs">
                      Verified
                    </Badge>
                  )}
                  {isSelf && (
                    <Badge variant="outline" className="border-border text-muted-foreground text-xs">
                      You
                    </Badge>
                  )}
                  {isFriend && !isSelf && (
                    <Badge variant="outline" className="border-emerald-500/60 text-emerald-300 text-xs">
                      Friend
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {profile.current_status === 'active'
                    ? profile.current_task
                      ? `Locked in on ${profile.current_task}`
                      : 'Locked in'
                    : profile.current_status === 'paused'
                    ? 'On a short break'
                    : profile.current_status === 'online'
                    ? 'Online'
                    : 'Offline'}
                </p>
                {profile.bio && (
                  <p className="text-sm text-foreground/70 mt-1.5">{profile.bio}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isFriend && !isSelf && (
                <PokeButton targetUserId={profile.id} targetUsername={profile.username || 'user'} />
              )}
              {isSelf && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border text-foreground hover:bg-muted"
                  asChild
                >
                  <a href="/profile/edit">Edit profile</a>
                </Button>
              )}
            </div>
          </div>

          {/* Goals — inline within header */}
          {profile.goals && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2 mb-1.5">
                <Target className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Prepping for</span>
              </div>
              <div className="text-sm text-foreground/80 whitespace-pre-line leading-relaxed">
                {profile.goals}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grades — single compact card */}
      <Card className="bg-muted/60 border-border">
        <CardContent className="p-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border">
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">Today</p>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-foreground">{grades.day}</span>
                <span className="text-xs text-muted-foreground">{formatSeconds(historyStats?.daily?.total_seconds ?? 0)}</span>
              </div>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">Week</p>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-foreground">{grades.week}</span>
                <span className="text-xs text-muted-foreground">{formatSeconds(historyStats?.weekly?.total_seconds ?? 0)}</span>
              </div>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">Month</p>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-foreground">{grades.month}</span>
                <span className="text-xs text-muted-foreground">{formatSeconds(historyStats?.monthly?.total_seconds ?? 0)}</span>
              </div>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">Peak hours</p>
              <div className="text-xs text-foreground/70 space-y-0.5 mt-1">
                <p>Today: <span className="text-foreground font-medium">{historyStats?.daily?.peak_hour != null ? `${historyStats.daily.peak_hour}:00` : '–'}</span></p>
                <p>Month: <span className="text-foreground font-medium">{historyStats?.monthly?.peak_hour != null ? `${historyStats.monthly.peak_hour}:00` : '–'}</span></p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Heatmap */}
      <HeatMap initialData={heatmap} />

      {/* Top subjects — side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-muted/60 border-border">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Today</p>
            {topTasksDaily.length === 0 ? (
              <p className="text-xs text-muted-foreground">No sessions today.</p>
            ) : (
              <div className="space-y-2">
                {topTasksDaily.slice(0, 5).map((task, i) => (
                  <div key={`${task.task_name}-${i}`} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground/70 truncate mr-2">{task.task_name}</span>
                      <span className="text-muted-foreground shrink-0">{formatSeconds(task.total_seconds)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-card overflow-hidden">
                      <div className="h-full bg-emerald-500/70" style={{ width: `${Math.min(100, (task.total_seconds / (topTasksDaily[0]?.total_seconds || 1)) * 100).toFixed(0)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-muted/60 border-border">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">This week</p>
            {topTasksWeekly.length === 0 ? (
              <p className="text-xs text-muted-foreground">No sessions this week.</p>
            ) : (
              <div className="space-y-2">
                {topTasksWeekly.slice(0, 5).map((task, i) => (
                  <div key={`${task.task_name}-${i}`} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground/70 truncate mr-2">{task.task_name}</span>
                      <span className="text-muted-foreground shrink-0">{formatSeconds(task.total_seconds)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-card overflow-hidden">
                      <div className="h-full bg-sky-500/70" style={{ width: `${Math.min(100, (task.total_seconds / (topTasksWeekly[0]?.total_seconds || 1)) * 100).toFixed(0)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Friends */}
      {friendsPreview.length > 0 && (
        <Card className="bg-muted/60 border-border">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Friends</p>
            <div className="flex flex-wrap gap-2">
              {friendsPreview.map(friend => (
                <a
                  key={friend.id}
                  href={`/profile/${encodeURIComponent(friend.id)}`}
                  className="flex items-center gap-2 rounded-full border border-border px-2.5 py-1 hover:bg-card/60 transition-colors"
                >
                  <Avatar className="h-6 w-6 border border-border">
                    <AvatarImage src={friend.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px]">
                      {friend.username.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-foreground max-w-[100px] truncate">
                    {friend.username}
                  </span>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

