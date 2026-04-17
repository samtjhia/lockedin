'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { type HealthInsights } from '@/app/actions/profile'
import { ChevronDown, ExternalLink, Medal } from 'lucide-react'

type HealthInsightsPanelProps = {
  insights: HealthInsights | null
}

function formatHoursAndMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours <= 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

function formatPace(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const minutes = Math.floor(value)
  const seconds = Math.round((value - minutes) * 60)
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`
}

function formatSpeed(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value.toFixed(1)} km/h`
}

function formatDurationFromMinutes(value: number): string {
  const totalSeconds = Math.max(0, Math.round(value * 60))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

function ordinal(value: number): string {
  const mod10 = value % 10
  const mod100 = value % 100
  if (mod10 === 1 && mod100 !== 11) return `${value}st`
  if (mod10 === 2 && mod100 !== 12) return `${value}nd`
  if (mod10 === 3 && mod100 !== 13) return `${value}rd`
  return `${value}th`
}

function prettyEffortLabel(label: string): string {
  const normalized = label.trim().toLowerCase()
  if (normalized === '1k') return '1K'
  if (normalized === '5k') return '5K'
  if (normalized === '10k') return '10K'
  return label
}

function topResultLabel(label: string, prRank: number | null): string {
  const effort = prettyEffortLabel(label)
  if (prRank == null) return `Top ${effort}`
  if (prRank === 1) return `Fastest ${effort}`
  return `${ordinal(prRank)} fastest ${effort}`
}

function activitySummaryMetric(group: HealthInsights['activityGroups'][number]): string {
  if (group.activityType === 'RUN' || group.activityType === 'VIRTUALRUN') {
    return `Avg pace ${formatPace(group.averagePaceMinPerKm)}`
  }
  if (group.activityType === 'WALK' || group.activityType === 'HIKE') {
    return `Avg pace ${formatPace(group.averagePaceMinPerKm)}`
  }
  if (group.activityType === 'RIDE' || group.activityType === 'VIRTUALRIDE') {
    return `Avg speed ${formatSpeed(group.averageSpeedKph)}`
  }
  return `Distance ${group.totalDistanceKm.toFixed(2)} km`
}

function primaryMetricForSession(
  groupType: string,
  session: HealthInsights['activityGroups'][number]['sessions'][number]
): string {
  if (groupType === 'RUN' || groupType === 'VIRTUALRUN' || groupType === 'WALK' || groupType === 'HIKE') {
    return formatPace(session.paceMinPerKm)
  }
  if (groupType === 'RIDE' || groupType === 'VIRTUALRIDE') {
    return formatSpeed(session.speedKph)
  }
  return `${Math.round(session.durationMinutes)}m`
}

export function HealthInsightsPanel({ insights }: HealthInsightsPanelProps) {
  if (!insights) return null

  const [timeframe, setTimeframe] = useState<'weekly' | 'monthly'>('weekly')
  const [activityFilter, setActivityFilter] = useState<string>('all')

  const activityOptions = useMemo(() => {
    const options = Array.from(new Set(insights.sessions.map((session) => session.activityType)))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
    return ['all', ...options]
  }, [insights.sessions])

  const filtered = useMemo(() => {
    const reference = new Date(insights.generatedAtIso)
    const rangeDays = timeframe === 'weekly' ? 7 : 30
    const start = new Date(reference)
    start.setUTCDate(reference.getUTCDate() - (rangeDays - 1))
    start.setUTCHours(0, 0, 0, 0)

    const sessions = insights.sessions.filter((session) => {
      const started = new Date(session.startedAt)
      if (started < start) return false
      if (activityFilter !== 'all' && session.activityType !== activityFilter) return false
      return true
    })

    const totalActivities = sessions.length
    const totalMinutes = sessions.reduce((sum, session) => sum + session.durationMinutes, 0)
    const totalDistanceKm = sessions.reduce((sum, session) => sum + session.distanceKm, 0)
    const totalElevationM = sessions.reduce((sum, session) => sum + session.elevationM, 0)

    const dailyMap = new Map<string, number>()
    for (const session of sessions) {
      const day = session.startedAt.slice(0, 10)
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + session.durationMinutes)
    }

    const trend: { date: string; minutes: number }[] = []
    const cursor = new Date(start)
    while (cursor <= reference) {
      const date = cursor.toISOString().slice(0, 10)
      trend.push({ date, minutes: Math.round((dailyMap.get(date) ?? 0) * 10) / 10 })
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }

    const groupMap = new Map<string, typeof sessions>()
    for (const session of sessions) {
      const existing = groupMap.get(session.activityType) ?? []
      existing.push(session)
      groupMap.set(session.activityType, existing)
    }
    const activityGroups = Array.from(groupMap.entries())
      .map(([activityType, groupSessions]) => {
        const paceValues = groupSessions.map((s) => s.paceMinPerKm).filter((value) => value != null) as number[]
        const speedValues = groupSessions.map((s) => s.speedKph).filter((value) => value != null) as number[]
        return {
          activityType,
          totalActivities: groupSessions.length,
          totalDistanceKm: groupSessions.reduce((sum, session) => sum + session.distanceKm, 0),
          averagePaceMinPerKm:
            paceValues.length > 0 ? paceValues.reduce((a, b) => a + b, 0) / paceValues.length : null,
          averageSpeedKph:
            speedValues.length > 0 ? speedValues.reduce((a, b) => a + b, 0) / speedValues.length : null,
          sessions: [...groupSessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
        }
      })
      .sort((a, b) => b.totalActivities - a.totalActivities)

    const hasLegacyGrouping = insights.prGroups.some(
      (group) => group.label.toLowerCase() === 'best efforts' || group.label.toLowerCase() === 'records'
    )

    const normalizedPrGroups = hasLegacyGrouping
      ? (() => {
          const grouped = new Map<
            string,
            {
              id: string
              label: string
              activityType: string
              items: typeof insights.prGroups[number]['items']
            }
          >()

          for (const group of insights.prGroups) {
            for (const item of group.items) {
              const activityType =
                ('activityType' in item && typeof item.activityType === 'string' && item.activityType.length > 0
                  ? item.activityType
                  : item.context.split(' • ')[0] || 'OTHER')
              const key = activityType
              const existing = grouped.get(key) ?? {
                id: `activity-${key.toLowerCase().replace(/\s+/g, '-')}`,
                label: key,
                activityType: key,
                items: [],
              }
              existing.items.push(item)
              grouped.set(key, existing)
            }
          }

          return Array.from(grouped.values()).sort((a, b) => b.items.length - a.items.length)
        })()
      : insights.prGroups

    const prGroups =
      activityFilter === 'all'
        ? normalizedPrGroups
        : normalizedPrGroups.filter((group) => group.activityType === activityFilter)

    return {
      totalActivities,
      totalMinutes,
      totalDistanceKm,
      totalElevationM,
      trend,
      activityGroups,
      prGroups,
    }
  }, [activityFilter, timeframe, insights.generatedAtIso, insights.sessions, insights.prGroups])

  const activeTrend = filtered.trend.filter((item) => item.minutes > 0)
  const maxMinutes = activeTrend.reduce((max, item) => Math.max(max, item.minutes), 0)

  return (
    <Card className="bg-muted/60 border-border">
      <CardContent className="p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Health Insights (Strava)</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Last {insights.windowDays} days of imported Strava workouts.
          </p>
          {insights.stravaProfileUrl && (
            <div className="mt-2">
              <Button asChild size="sm" variant="outline">
                <a
                  href={insights.stravaProfileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-orange-300 hover:text-orange-200"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View athlete on Strava
                </a>
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            <button
              type="button"
              className={`px-3 py-1.5 text-xs ${timeframe === 'weekly' ? 'bg-orange-500/20 text-orange-300' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setTimeframe('weekly')}
            >
              Weekly
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 text-xs border-l border-border ${timeframe === 'monthly' ? 'bg-orange-500/20 text-orange-300' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setTimeframe('monthly')}
            >
              Monthly
            </button>
          </div>

          <label className="text-xs text-muted-foreground inline-flex items-center gap-2">
            Activity
            <select
              className="bg-card border border-border rounded-md px-2 py-1 text-xs text-foreground"
              value={activityFilter}
              onChange={(event) => setActivityFilter(event.target.value)}
            >
              {activityOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? 'All' : option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="rounded-md border border-border p-2">
            <p className="text-muted-foreground">Workouts</p>
            <p className="text-foreground font-semibold mt-1">{filtered.totalActivities}</p>
          </div>
          <div className="rounded-md border border-border p-2">
            <p className="text-muted-foreground">Total time</p>
            <p className="text-foreground font-semibold mt-1">{formatHoursAndMinutes(Math.round(filtered.totalMinutes))}</p>
          </div>
          <div className="rounded-md border border-border p-2">
            <p className="text-muted-foreground">Distance</p>
            <p className="text-foreground font-semibold mt-1">{filtered.totalDistanceKm.toFixed(2)} km</p>
          </div>
          <div className="rounded-md border border-border p-2">
            <p className="text-muted-foreground">Elevation gain</p>
            <p className="text-foreground font-semibold mt-1">{Math.round(filtered.totalElevationM)} m</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">{timeframe === 'weekly' ? 'Last 7 days' : 'Last 30 days'}</p>
          {activeTrend.length === 0 ? (
            <p className="text-xs text-muted-foreground">No activity in this period.</p>
          ) : (
            <div className="space-y-1.5">
              {activeTrend.map((entry) => {
                const widthPct = maxMinutes > 0 ? Math.max(3, (entry.minutes / maxMinutes) * 100) : 0
                return (
                  <div key={entry.date} className="grid grid-cols-[72px_1fr_auto] gap-2 items-center text-xs">
                    <span className="text-muted-foreground">{entry.date.slice(5)}</span>
                    <div className="h-1.5 rounded-full bg-card overflow-hidden">
                      <div className="h-full bg-orange-500/70" style={{ width: `${widthPct}%` }} />
                    </div>
                    <span className="text-foreground/80">{Math.round(entry.minutes)}m</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Activity breakdown</p>
          {filtered.activityGroups.length === 0 ? (
            <p className="text-xs text-muted-foreground">No activity data yet.</p>
          ) : (
            <div className="space-y-2">
              {filtered.activityGroups.map((group) => (
                <details key={group.activityType} className="rounded-md border border-border bg-card/40 px-3 py-2">
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-foreground">{group.activityType}</span>
                      <span className="text-muted-foreground">
                        {group.totalActivities} workouts • {group.totalDistanceKm.toFixed(2)} km • {activitySummaryMetric(group)}
                      </span>
                    </div>
                  </summary>
                  <div className="mt-2 space-y-2">
                    {group.sessions.map((session, index) => (
                      <div key={`${session.startedAt}-${session.taskName}-${index}`} className="text-xs border-t border-border/70 pt-2 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-foreground/90">{session.taskName}</span>
                          <span className="text-muted-foreground">{primaryMetricForSession(group.activityType, session)}</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          <div className="rounded-md border border-border/70 bg-card/40 p-2">
                            <p className="text-muted-foreground text-[11px]">Distance</p>
                            <p className="text-foreground font-semibold">{session.distanceKm.toFixed(2)} km</p>
                          </div>
                          <div className="rounded-md border border-border/70 bg-card/40 p-2">
                            <p className="text-muted-foreground text-[11px]">Moving time</p>
                            <p className="text-foreground font-semibold">{formatDurationFromMinutes(session.movingTimeMinutes)}</p>
                          </div>
                          <div className="rounded-md border border-border/70 bg-card/40 p-2">
                            <p className="text-muted-foreground text-[11px]">
                              {group.activityType === 'RIDE' || group.activityType === 'VIRTUALRIDE' ? 'Speed' : 'Pace'}
                            </p>
                            <p className="text-foreground font-semibold">
                              {group.activityType === 'RIDE' || group.activityType === 'VIRTUALRIDE'
                                ? formatSpeed(session.speedKph)
                                : formatPace(session.paceMinPerKm)}
                            </p>
                          </div>
                          <div className="rounded-md border border-border/70 bg-card/40 p-2">
                            <p className="text-muted-foreground text-[11px]">Elevation</p>
                            <p className="text-foreground font-semibold">{session.elevationM} m</p>
                          </div>
                          <div className="rounded-md border border-border/70 bg-card/40 p-2">
                            <p className="text-muted-foreground text-[11px]">Calories</p>
                            <p className="text-foreground font-semibold">{session.calories != null ? session.calories : '—'}</p>
                          </div>
                          {session.description && (
                            <div className="col-span-2 sm:col-span-3 rounded-md border border-border/70 bg-card/40 p-2">
                              <p className="text-muted-foreground text-[11px]">Description</p>
                              <p className="text-foreground/90 whitespace-pre-wrap">{session.description}</p>
                            </div>
                          )}
                        </div>

                        {session.topResults.length > 0 && (
                          <div className="rounded-md border border-orange-500/30 bg-orange-500/5 p-2">
                            <p className="text-[11px] text-orange-300 mb-1 inline-flex items-center gap-1">
                              <Medal className="w-3.5 h-3.5" />
                              Top results
                            </p>
                            <div className="space-y-1">
                              {session.topResults.map((result, resultIndex) => (
                                <div key={`${result.label}-${resultIndex}`} className="flex items-center justify-between text-[11px]">
                                  <span className="text-foreground/90">{topResultLabel(result.label, result.prRank)}</span>
                                  <span className="text-muted-foreground">
                                    {formatDurationFromMinutes(result.elapsedSeconds / 60)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2 mt-1">
                          <span className="text-muted-foreground">{formatDateTime(session.startedAt)}</span>
                          {session.stravaActivityUrl && (
                            <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-orange-300 hover:text-orange-200">
                              <a href={session.stravaActivityUrl} target="_blank" rel="noreferrer">
                                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                                Open activity
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs font-medium text-muted-foreground">PRs</p>
            <span className="text-[11px] text-muted-foreground">Uses Strava best efforts when available</span>
          </div>
          {filtered.prGroups.length === 0 ? (
            <p className="text-xs text-muted-foreground">No PR data available yet.</p>
          ) : (
            <div className="space-y-2">
              {filtered.prGroups.map((group) => (
                <details key={group.id} className="rounded-md border border-border bg-card/40 px-3 py-2">
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{group.label}</span>
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        {group.items.length}
                        <ChevronDown className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </summary>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    {group.items.map((pr) => (
                      <div key={`${group.id}-${pr.label}-${pr.context}`} className="rounded-md border border-border bg-card/40 p-2 text-xs">
                        <p className="text-muted-foreground">{pr.label}</p>
                        <p className="text-foreground font-semibold mt-1">{pr.value}</p>
                        <p className="text-muted-foreground mt-1">{pr.context}</p>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
