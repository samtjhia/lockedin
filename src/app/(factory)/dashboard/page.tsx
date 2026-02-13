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

export default async function Dashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single()

  // Fetch active session if any
  const currentSession = await checkCurrentSession()

  return (
    <YouTubePlayerProvider>
      <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto min-h-screen">
        {/* Header */}
        <div className="border-b border-zinc-800 pb-4">
          <div className="flex flex-col gap-1 mb-4">
            <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
            <p className="text-zinc-400">
              Welcome back, <span className="text-zinc-200 font-medium">{profile?.username}</span>. 
              Ready to lock in?
            </p>
          </div>
          {/* Full-width toolbar */}
          <DashboardToolbar />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 pb-8">
          {/* Left Column: Tasks (1 col) */}
          <div className="lg:col-span-1 relative">
              <div className="absolute inset-0">
                  <TaskList />
              </div>
          </div>

          {/* Center Column: Focus & Charts (2 cols) */}
          <div className="lg:col-span-2 space-y-6 flex flex-col">
              <FocusController initialSession={currentSession} />
              <div className="grid grid-cols-1 gap-6">
                  <Charts />
                  <HeatMap />
              </div>
          </div>

          {/* Right Column: YouTube Player & Log (1 col) */}
          <div className="lg:col-span-1 relative">
              <div className="absolute inset-0 flex flex-col gap-4">
                  <YouTubePlayer />
                  <div className="flex-1 relative min-h-0">
                      <div className="absolute inset-0">
                          <ShiftLog />
                      </div>
                  </div>
              </div>
          </div>
        </div>
      </div>
    </YouTubePlayerProvider>
  )
}
