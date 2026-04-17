'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, ExternalLink, Loader2, RefreshCcw, Settings2, Unplug } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

type StravaHealthPanelProps = {
  stravaConnection: {
    athlete_id: number
    athlete_username: string | null
    athlete_name: string | null
    connected_at: string
    included_activity_types: string[] | null
  } | null
  stravaSyncState: {
    sync_in_progress: boolean
    last_synced_at: string | null
    last_success_at: string | null
    last_error_at: string | null
    last_error_message: string | null
  } | null
}

const STRAVA_ACTIVITY_OPTIONS = [
  'RUN',
  'RIDE',
  'WALK',
  'HIKE',
  'SWIM',
  'WORKOUT',
  'WEIGHTTRAINING',
  'VIRTUALRIDE',
  'VIRTUALRUN',
] as const

function formatDateTime(value: string | null) {
  if (!value) return '—'
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

export function StravaHealthPanel({ stravaConnection, stravaSyncState }: StravaHealthPanelProps) {
  const router = useRouter()
  const [isHydrated, setIsHydrated] = useState(false)
  const [manuallyDisconnected, setManuallyDisconnected] = useState(false)
  const [syncingStrava, setSyncingStrava] = useState(false)
  const [disconnectingStrava, setDisconnectingStrava] = useState(false)
  const [syncStatus, setSyncStatus] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [selectedActivityTypes, setSelectedActivityTypes] = useState<string[]>(
    stravaConnection?.included_activity_types?.length
      ? stravaConnection.included_activity_types
      : [...STRAVA_ACTIVITY_OPTIONS]
  )
  const [savingActivityTypes, setSavingActivityTypes] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const isConnected = Boolean(stravaConnection) && !manuallyDisconnected

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  async function handleSyncNow() {
    setSyncError(null)
    setSyncStatus(null)
    setSyncingStrava(true)
    try {
      const response = await fetch('/api/integrations/strava/sync', { method: 'POST' })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to sync Strava')
      }
      setSyncStatus(`Synced: ${result.imported} imported, ${result.skipped} skipped, ${result.fetched} fetched`)
      router.refresh()
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Failed to sync Strava')
    } finally {
      setSyncingStrava(false)
    }
  }

  async function handleDisconnectStrava() {
    setSyncError(null)
    setSyncStatus(null)
    setDisconnectingStrava(true)
    try {
      const response = await fetch('/api/integrations/strava/disconnect', { method: 'POST' })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to disconnect Strava')
      }
      setManuallyDisconnected(true)
      setSyncStatus('Strava disconnected.')
      router.refresh()
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Failed to disconnect Strava')
    } finally {
      setDisconnectingStrava(false)
    }
  }

  async function updateActivityTypes(nextTypes: string[]) {
    setSavingActivityTypes(true)
    setSyncError(null)
    try {
      const response = await fetch('/api/integrations/strava/activity-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityTypes: nextTypes }),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update activity types')
      }
      setSelectedActivityTypes(result.activityTypes || nextTypes)
      setSyncStatus('Activity type preferences updated.')
      router.refresh()
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Failed to update activity types')
    } finally {
      setSavingActivityTypes(false)
    }
  }

  function toggleActivityType(type: string) {
    const isSelected = selectedActivityTypes.includes(type)
    const next = isSelected
      ? selectedActivityTypes.filter((value) => value !== type)
      : [...selectedActivityTypes, type]
    setSelectedActivityTypes(next)
    updateActivityTypes(next)
  }

  return (
    <Card className="bg-muted/60 border-border">
      <CardContent className="p-4 space-y-4">
        {!isHydrated ? (
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Strava Integration</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Connect Strava to auto-import workouts into your Health domain.
              </p>
            </div>
            <div className="h-9 rounded-md bg-card/60 animate-pulse" />
            <div className="h-9 rounded-md bg-card/60 animate-pulse" />
          </div>
        ) : (
          <>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Strava Integration</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Connect Strava to auto-import workouts into your Health domain.
          </p>
        </div>

        {isConnected && stravaConnection ? (
          <div className="space-y-3">
            <div className="text-xs text-foreground/80 font-medium">
              {stravaConnection.athlete_name || stravaConnection.athlete_username || `Athlete ${stravaConnection.athlete_id}`}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleSyncNow}
                disabled={syncingStrava || Boolean(stravaSyncState?.sync_in_progress)}
              >
                {syncingStrava || stravaSyncState?.sync_in_progress ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="w-4 h-4 mr-2" />
                    Sync now
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDisconnectStrava}
                disabled={disconnectingStrava}
              >
                {disconnectingStrava ? (
                  'Disconnecting...'
                ) : (
                  <>
                    <Unplug className="w-4 h-4 mr-2" />
                    Disconnect Strava
                  </>
                )}
              </Button>
              <Button asChild type="button" variant="outline">
                <a
                  href={`https://www.strava.com/athletes/${stravaConnection.athlete_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-orange-300 hover:text-orange-200"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Strava profile
                </a>
              </Button>
            </div>

            <details
              className="rounded-md border border-border bg-card/40 px-3 py-2"
              onToggle={(event) => {
                setSettingsOpen((event.currentTarget as HTMLDetailsElement).open)
              }}
            >
              <summary className="list-none cursor-pointer">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Settings2 className="w-3.5 h-3.5" />
                    Strava settings
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
                </div>
              </summary>

              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <p>Connected: {formatDateTime(stravaConnection.connected_at)}</p>
                  <p>Last sync: {formatDateTime(stravaSyncState?.last_success_at ?? null)}</p>
                </div>
                {stravaSyncState?.last_error_message && (
                  <p className="text-xs text-red-400">
                    Last error ({formatDateTime(stravaSyncState.last_error_at)}): {stravaSyncState.last_error_message}
                  </p>
                )}

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Included activity types</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {STRAVA_ACTIVITY_OPTIONS.map((type) => {
                      const checked = selectedActivityTypes.includes(type)
                      return (
                        <label key={type} className="flex items-center gap-2 text-xs text-foreground/80">
                          <Checkbox
                            checked={checked}
                            disabled={savingActivityTypes}
                            onCheckedChange={() => toggleActivityType(type)}
                          />
                          <span>{type}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </div>
            </details>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              No Strava account connected. Strava will connect whichever account is currently signed in on this browser.
            </p>
            <Button asChild type="button">
              <Link href="/api/integrations/strava/connect">Connect Strava</Link>
            </Button>
          </div>
        )}

        {syncStatus && <p className="text-xs text-orange-400">{syncStatus}</p>}
        {syncError && <p className="text-xs text-red-400">{syncError}</p>}
          </>
        )}
      </CardContent>
    </Card>
  )
}
