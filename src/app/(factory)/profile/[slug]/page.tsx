import { notFound } from 'next/navigation'
import { getUserProfileData } from '@/app/actions/profile'
import { effectiveStatus } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { HeatMap } from '@/components/dashboard/stats/heat-map'
import { Target, HelpCircle, Medal } from 'lucide-react'
import { PokeButton } from '@/components/profile/poke-button'
import { AddFriendButton } from '@/components/profile/add-friend-button'

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
    hasPendingRequestToThem,
    grades,
    heatmap,
    topTasksDaily,
    topTasksWeekly,
    historyStats,
    medalHistory,
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

  const formatMedalDate = (dateStr: string) => {
    try {
      return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return dateStr
    }
  }

  const dailyGold = medalHistory.daily.filter((e) => e.rank === 1)
  const dailySilver = medalHistory.daily.filter((e) => e.rank === 2)
  const dailyBronze = medalHistory.daily.filter((e) => e.rank === 3)
  const weeklyGold = medalHistory.weekly.filter((e) => e.rank === 1)
  const weeklySilver = medalHistory.weekly.filter((e) => e.rank === 2)
  const weeklyBronze = medalHistory.weekly.filter((e) => e.rank === 3)

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
                  {(() => {
                    const status = effectiveStatus(profile.current_status, profile.updated_at ?? null)
                    return status === 'active'
                      ? profile.current_task
                        ? `Locked in on ${profile.current_task}`
                        : 'Locked in'
                      : status === 'paused'
                      ? 'On a short break'
                      : status === 'online'
                      ? 'Online'
                      : 'Offline'
                  })()}
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
              {!isSelf && !isFriend && (
                <AddFriendButton
                  targetUserId={profile.id}
                  targetUsername={profile.username || 'Unknown user'}
                  initialRequestSent={hasPendingRequestToThem}
                />
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
            <div className="px-4 py-3 relative group/day">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                Today
                <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help shrink-0" />
              </p>
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 w-44 min-w-[11rem] rounded-lg border border-border bg-popover px-3 py-2.5 text-popover-foreground shadow-xl text-[10px] opacity-0 pointer-events-none group-hover/day:opacity-100 group-hover/day:pointer-events-auto transition-opacity origin-top">
                <span className="font-semibold text-foreground">Daily grade</span>
                <div className="mt-1.5 space-y-0.5 text-muted-foreground">
                  <div className="flex justify-between gap-4"><span className="text-indigo-400 font-bold shrink-0">S</span><span>6+ h</span></div>
                  <div className="flex justify-between gap-4"><span className="text-green-400 font-bold shrink-0">A</span><span>4+ h</span></div>
                  <div className="flex justify-between gap-4"><span className="text-blue-400 font-bold shrink-0">B</span><span>3+ h</span></div>
                  <div className="flex justify-between gap-4"><span className="font-bold shrink-0">C</span><span>2+ h</span></div>
                  <div className="flex justify-between gap-4"><span className="font-bold shrink-0">D</span><span>1+ h</span></div>
                  <div className="flex justify-between gap-4"><span className="font-bold shrink-0">F</span><span>&lt;1 h</span></div>
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-foreground">{grades.day}</span>
                <span className="text-xs text-muted-foreground">{formatSeconds(historyStats?.daily?.total_seconds ?? 0)}</span>
              </div>
            </div>
            <div className="px-4 py-3 relative group/week">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                Week
                <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help shrink-0" />
              </p>
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 w-44 min-w-[11rem] rounded-lg border border-border bg-popover px-3 py-2.5 text-popover-foreground shadow-xl text-[10px] opacity-0 pointer-events-none group-hover/week:opacity-100 group-hover/week:pointer-events-auto transition-opacity origin-top">
                <span className="font-semibold text-foreground">Weekly grade</span>
                <div className="mt-1.5 space-y-0.5 text-muted-foreground">
                  <div className="flex justify-between gap-4"><span className="text-indigo-400 font-bold shrink-0">S</span><span>30+ h</span></div>
                  <div className="flex justify-between gap-4"><span className="text-green-400 font-bold shrink-0">A</span><span>20+ h</span></div>
                  <div className="flex justify-between gap-4"><span className="text-blue-400 font-bold shrink-0">B</span><span>15+ h</span></div>
                  <div className="flex justify-between gap-4"><span className="font-bold shrink-0">C</span><span>10+ h</span></div>
                  <div className="flex justify-between gap-4"><span className="font-bold shrink-0">D</span><span>5+ h</span></div>
                  <div className="flex justify-between gap-4"><span className="font-bold shrink-0">F</span><span>&lt;5 h</span></div>
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-foreground">{grades.week}</span>
                <span className="text-xs text-muted-foreground">{formatSeconds(historyStats?.weekly?.total_seconds ?? 0)}</span>
              </div>
            </div>
            <div className="px-4 py-3 relative group/month">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                Month
                <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help shrink-0" />
              </p>
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 w-44 min-w-[11rem] rounded-lg border border-border bg-popover px-3 py-2.5 text-popover-foreground shadow-xl text-[10px] opacity-0 pointer-events-none group-hover/month:opacity-100 group-hover/month:pointer-events-auto transition-opacity origin-top">
                <span className="font-semibold text-foreground">Monthly grade</span>
                <div className="mt-1.5 space-y-0.5 text-muted-foreground">
                  <div className="flex justify-between gap-4"><span className="text-indigo-400 font-bold shrink-0">S</span><span>100+ h</span></div>
                  <div className="flex justify-between gap-4"><span className="text-green-400 font-bold shrink-0">A</span><span>80+ h</span></div>
                  <div className="flex justify-between gap-4"><span className="text-blue-400 font-bold shrink-0">B</span><span>60+ h</span></div>
                  <div className="flex justify-between gap-4"><span className="font-bold shrink-0">C</span><span>40+ h</span></div>
                  <div className="flex justify-between gap-4"><span className="font-bold shrink-0">D</span><span>20+ h</span></div>
                  <div className="flex justify-between gap-4"><span className="font-bold shrink-0">F</span><span>&lt;20 h</span></div>
                </div>
              </div>
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

      {/* Medals — daily and weekly with dates */}
      <Card className="bg-muted/60 border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Medal className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Medals</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Daily</p>
              <div className="space-y-1.5 text-xs">
                <p className="text-foreground/80">
                  <span className="text-yellow-400 font-medium">Gold:</span> {dailyGold.length}
                  {dailyGold.length > 0 && (
                    <span className="text-muted-foreground ml-1">
                      — {dailyGold.map((e) => e.date && formatMedalDate(e.date)).filter(Boolean).join(', ')}
                    </span>
                  )}
                </p>
                <p className="text-foreground/80">
                  <span className="text-zinc-300 font-medium">Silver:</span> {dailySilver.length}
                  {dailySilver.length > 0 && (
                    <span className="text-muted-foreground ml-1">
                      — {dailySilver.map((e) => e.date && formatMedalDate(e.date)).filter(Boolean).join(', ')}
                    </span>
                  )}
                </p>
                <p className="text-foreground/80">
                  <span className="text-amber-700 font-medium">Bronze:</span> {dailyBronze.length}
                  {dailyBronze.length > 0 && (
                    <span className="text-muted-foreground ml-1">
                      — {dailyBronze.map((e) => e.date && formatMedalDate(e.date)).filter(Boolean).join(', ')}
                    </span>
                  )}
                </p>
                {dailyGold.length === 0 && dailySilver.length === 0 && dailyBronze.length === 0 && (
                  <p className="text-muted-foreground italic">No daily medals in the past 6 weeks.</p>
                )}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Weekly</p>
              <div className="space-y-1.5 text-xs">
                <p className="text-foreground/80">
                  <span className="text-yellow-400 font-medium">Gold:</span> {weeklyGold.length}
                  {weeklyGold.length > 0 && (
                    <span className="text-muted-foreground ml-1">
                      — {weeklyGold.map((e) => e.week_start && formatMedalDate(e.week_start)).filter(Boolean).join(', ')}
                    </span>
                  )}
                </p>
                <p className="text-foreground/80">
                  <span className="text-zinc-300 font-medium">Silver:</span> {weeklySilver.length}
                  {weeklySilver.length > 0 && (
                    <span className="text-muted-foreground ml-1">
                      — {weeklySilver.map((e) => e.week_start && formatMedalDate(e.week_start)).filter(Boolean).join(', ')}
                    </span>
                  )}
                </p>
                <p className="text-foreground/80">
                  <span className="text-amber-700 font-medium">Bronze:</span> {weeklyBronze.length}
                  {weeklyBronze.length > 0 && (
                    <span className="text-muted-foreground ml-1">
                      — {weeklyBronze.map((e) => e.week_start && formatMedalDate(e.week_start)).filter(Boolean).join(', ')}
                    </span>
                  )}
                </p>
                {weeklyGold.length === 0 && weeklySilver.length === 0 && weeklyBronze.length === 0 && (
                  <p className="text-muted-foreground italic">No weekly medals in the past 6 weeks.</p>
                )}
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

