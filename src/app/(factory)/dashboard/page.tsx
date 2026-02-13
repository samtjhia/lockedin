import { Suspense } from 'react'
import { checkCurrentSession } from '../actions'
import { createClient } from '@/utils/supabase/server'
import { FocusController } from '@/components/factory/focus-controller'
import { TaskList } from '@/components/dashboard/tasks/task-list'
import { HeatMap } from '@/components/dashboard/stats/heat-map'
import { Charts } from '@/components/dashboard/stats/charts'
import { ShiftLog } from '@/components/dashboard/stats/shift-log'
import { DashboardToolbar } from '@/components/dashboard/dashboard-toolbar'
import { YouTubePlayer } from '@/components/dashboard/youtube-player'
import { YouTubePlayerProvider } from '@/components/dashboard/youtube-player-context'
import { DashboardGrid } from '@/components/dashboard/dashboard-grid'
import { getDashboardData } from '@/app/actions/dashboard'
import { 
  ChartsSkeleton, 
  HeatMapSkeleton, 
  TaskListSkeleton, 
  ShiftLogSkeleton, 
  ToolbarSkeleton 
} from '@/components/dashboard/skeletons'

export default async function Dashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Fetch ALL data in parallel - single round trip
  const [profile, currentSession, dashboardData] = await Promise.all([
    supabase.from('profiles').select('username').eq('id', user.id).single().then(r => r.data),
    checkCurrentSession(),
    getDashboardData()
  ])

  return (
    <YouTubePlayerProvider>
      <div className="p-4 md:p-8 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto min-h-screen">
        {/* Header */}
        <div className="border-b border-zinc-800 pb-4">
          <div className="flex flex-col gap-1 mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Dashboard</h1>
            <p className="text-zinc-400 text-sm sm:text-base">
              Welcome back, <span className="text-zinc-200 font-medium">{profile?.username}</span>. 
              Ready to lock in?
            </p>
          </div>
          {/* Full-width toolbar */}
          <DashboardToolbar 
            initialSounds={dashboardData.sounds}
            initialQuickLinks={dashboardData.quickLinks}
            initialYoutubeLinks={dashboardData.youtubeLinks}
          />
        </div>

        <DashboardGrid
          taskList={<TaskList initialTodos={dashboardData.todos} />}
          centerContent={
            <>
              <FocusController initialSession={currentSession} />
              <div className="grid grid-cols-1 gap-6">
                <Charts initialMetrics={dashboardData.dailyMetrics} />
                <HeatMap initialData={dashboardData.heatmapData} />
              </div>
            </>
          }
          youtubePlayer={<YouTubePlayer />}
          shiftLog={<ShiftLog initialLogs={dashboardData.shiftLog} />}
        />
      </div>
    </YouTubePlayerProvider>
  )
}
