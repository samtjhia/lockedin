import { checkCurrentSession } from '../actions'
import { createClient } from '@/utils/supabase/server'
import { FocusController } from '@/components/factory/focus-controller'
import { TaskList } from '@/components/dashboard/tasks/task-list'
import { HeatMap } from '@/components/dashboard/stats/heat-map'
import { Charts } from '@/components/dashboard/stats/charts'
import { ShiftLog } from '@/components/dashboard/stats/shift-log'
import { Soundscape } from '@/components/dashboard/soundscape'

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
    <div className="p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto min-h-screen">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 border-b border-zinc-800 pb-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
          <p className="text-zinc-400">
            Welcome back, <span className="text-zinc-200 font-medium">{profile?.username}</span>. 
            Ready to lock in?
          </p>
        </div>
        <div className="md:min-w-[300px]">
          <Soundscape />
        </div>
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

        {/* Right Column: Log & History (1 col) */}
        <div className="lg:col-span-1 relative">
            <div className="absolute inset-0">
                <ShiftLog />
            </div>
        </div>
      </div>
    </div>
  )
}
