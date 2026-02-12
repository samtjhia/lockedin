import { createClient } from '@/utils/supabase/server'
import { signOut } from '@/app/login/actions'
import { checkCurrentSession } from '../actions'
import { Button } from '@/components/ui/button'
import { FocusController } from '@/components/factory/focus-controller'
import { SocialSidebar } from '@/components/social/social-sidebar'
import { TaskList } from '@/components/dashboard/tasks/task-list'
import { HeatMap } from '@/components/dashboard/stats/heat-map'
import { Charts } from '@/components/dashboard/stats/charts'
import { ShiftLog } from '@/components/dashboard/stats/shift-log'
import { Soundscape } from '@/components/dashboard/soundscape'
import Link from 'next/link'
import { Trophy, LogOut } from 'lucide-react'

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
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Dashboard</h1>
          <p className="text-zinc-400">
            Welcome back, <span className="text-zinc-200 font-medium">{profile?.username}</span>. 
            Ready to lock in?
          </p>
        </div>
        <div className="flex items-center gap-3">
            <Link href="/">
                <Button variant="outline" className="text-zinc-400 border-zinc-800 bg-zinc-950 hover:bg-zinc-900 hover:text-white">
                    <Trophy className="h-4 w-4 mr-2" />
                    Leaderboard
                </Button>
            </Link>
            <SocialSidebar />
            <form action={signOut}>
                <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-red-400 hover:bg-red-400/10" title="Logout">
                    <LogOut className="h-5 w-5" />
                </Button>
            </form>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 pb-8">
        {/* Left Column: Tasks (1 col) */}
        <div className="lg:col-span-1 h-full">
            <TaskList />
        </div>

        {/* Center Column: Focus & Charts (2 cols) */}
        <div className="lg:col-span-2 space-y-6 flex flex-col">
            <FocusController initialSession={currentSession} />
            <Soundscape />
            <div className="grid grid-cols-1 gap-6">
                <Charts />
                <HeatMap />
            </div>
        </div>

        {/* Right Column: Log & History (1 col) */}
        <div className="lg:col-span-1 h-full">
            <ShiftLog />
        </div>
      </div>
    </div>
  )
}
