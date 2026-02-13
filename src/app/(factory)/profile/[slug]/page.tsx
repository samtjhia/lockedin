import { notFound } from 'next/navigation'
import { getUserProfileData } from '@/app/actions/profile'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { HeatMap } from '@/components/dashboard/stats/heat-map'

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
    const minutes = Math.round(seconds / 60)
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const rem = minutes % 60
    return rem ? `${hours}h ${rem}m` : `${hours}h`
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      {/* Identity header */}
      <Card className="bg-zinc-950/60 border-zinc-800">
        <CardContent className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border border-zinc-700">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold text-zinc-100">
                  {profile.username || 'Unknown user'}
                </h1>
                {profile.is_verified && (
                  <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/40 text-xs">
                    Verified
                  </Badge>
                )}
                {isSelf && (
                  <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs">
                    You
                  </Badge>
                )}
              </div>
              <p className="text-sm text-zinc-400 mt-1">
                {profile.current_status === 'active'
                  ? profile.current_task
                    ? `Locked in on ${profile.current_task}`
                    : 'Locked in'
                  : profile.current_status === 'paused'
                  ? 'On a short break'
                  : isSelf
                  ? 'Online'
                  : 'Offline'}
              </p>
              {profile.bio && (
                <p className="text-sm text-zinc-300 mt-2 max-w-md">{profile.bio}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isFriend && !isSelf && (
              <Badge variant="outline" className="border-emerald-500/60 text-emerald-300 text-xs">
                Friend
              </Badge>
            )}
            {isSelf && (
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                asChild
              >
                <a href="/profile/edit">Edit profile</a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Grades + summary row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-950/60 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-sm text-zinc-400">Today&apos;s grade</CardTitle>
          </CardHeader>
          <CardContent className="flex items-baseline justify-between">
            <span className="text-3xl font-semibold text-zinc-50">{grades.day}</span>
            <span className="text-xs text-zinc-500">
              {formatSeconds(historyStats?.daily?.total_seconds ?? 0)}
            </span>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950/60 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-sm text-zinc-400">This week</CardTitle>
          </CardHeader>
          <CardContent className="flex items-baseline justify-between">
            <span className="text-3xl font-semibold text-zinc-50">{grades.week}</span>
            <span className="text-xs text-zinc-500">
              {formatSeconds(historyStats?.weekly?.total_seconds ?? 0)}
            </span>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950/60 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-sm text-zinc-400">This month</CardTitle>
          </CardHeader>
          <CardContent className="flex items-baseline justify-between">
            <span className="text-3xl font-semibold text-zinc-50">{grades.month}</span>
            <span className="text-xs text-zinc-500">
              {formatSeconds(historyStats?.monthly?.total_seconds ?? 0)}
            </span>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950/60 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-sm text-zinc-400">Peak hours</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-300 space-y-1">
            <p>
              Today:{' '}
              <span className="text-zinc-100">
                {historyStats?.daily?.peak_hour != null
                  ? `${historyStats.daily.peak_hour}:00`
                  : '–'}
              </span>
            </p>
            <p>
              This month:{' '}
              <span className="text-zinc-100">
                {historyStats?.monthly?.peak_hour != null
                  ? `${historyStats.monthly.peak_hour}:00`
                  : '–'}
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Heatmap */}
          <HeatMap initialData={heatmap} />
        </div>

        <div className="space-y-4">
          {/* Top subjects / tasks */}
          <Card className="bg-zinc-950/60 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-sm text-zinc-400">Top subjects (today)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {topTasksDaily.length === 0 && (
                <p className="text-xs text-zinc-500">No focused work logged today yet.</p>
              )}
              {topTasksDaily.map(task => (
                <div key={task.task_name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-zinc-300">
                    <span className="truncate">{task.task_name}</span>
                    <span className="text-zinc-500">{formatSeconds(task.total_seconds)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500/70"
                      style={{
                        width: `${Math.min(
                          100,
                          (task.total_seconds /
                            (topTasksDaily[0]?.total_seconds || task.total_seconds || 1)) *
                            100,
                        ).toFixed(0)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-zinc-950/60 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-sm text-zinc-400">Top subjects (week)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {topTasksWeekly.length === 0 && (
                <p className="text-xs text-zinc-500">No sessions logged this week yet.</p>
              )}
              {topTasksWeekly.map(task => (
                <div key={task.task_name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-zinc-300">
                    <span className="truncate">{task.task_name}</span>
                    <span className="text-zinc-500">{formatSeconds(task.total_seconds)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                    <div
                      className="h-full bg-sky-500/70"
                      style={{
                        width: `${Math.min(
                          100,
                          (task.total_seconds /
                            (topTasksWeekly[0]?.total_seconds || task.total_seconds || 1)) *
                            100,
                        ).toFixed(0)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {isSelf && (
            <Card className="bg-zinc-950/60 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm text-zinc-400">Friends</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {friendsPreview.length === 0 && (
                  <p className="text-xs text-zinc-500">
                    You don&apos;t have any friends added yet. Head to the Social tab to find people.
                  </p>
                )}
                <div className="flex flex-wrap gap-3">
                  {friendsPreview.map(friend => (
                    <a
                      key={friend.id}
                      href={`/profile/${encodeURIComponent(friend.id)}`}
                      className="flex items-center gap-2 rounded-full border border-zinc-800 px-2 py-1 hover:border-zinc-700 hover:bg-zinc-900/60 transition-colors"
                    >
                      <Avatar className="h-7 w-7 border border-zinc-700">
                        <AvatarImage src={friend.avatar_url || undefined} />
                        <AvatarFallback>
                          {friend.username.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-zinc-200 max-w-[120px] truncate">
                        {friend.username}
                      </span>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

