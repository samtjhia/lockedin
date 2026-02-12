import { createClient } from '@/utils/supabase/server'
import { signOut } from '../../login/actions'
import { checkCurrentSession } from '../actions'
import { Button } from '@/components/ui/button'
import { FocusController } from '@/components/factory/focus-controller'
import { SocialSidebar } from '@/components/social/social-sidebar'
import Link from 'next/link'
import { Trophy } from 'lucide-react'

export default async function Dashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user?.id)
    .single()

  // Fetch active session if any
  const currentSession = await checkCurrentSession()

  return (
    <div className="p-8">
      <div className="grid gap-6">
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-lg flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold mb-2">Welcome Back, {profile?.username}</h2>
            <p className="text-zinc-400">Status: <span className={currentSession ? (currentSession.status === 'paused' ? "text-yellow-500 font-bold" : "text-green-500 font-bold") : "text-zinc-500"}>{currentSession ? (currentSession.status === 'paused' ? "Paused" : "Focusing") : "Ready"}</span></p>
          </div>
          <div className="flex gap-4">
            <Link href="/">
                <Button variant="outline" className="text-zinc-200 border-zinc-700 bg-transparent hover:bg-zinc-800 hover:text-white">
                    <Trophy className="h-4 w-4 mr-2" />
                    Leaderboard
                </Button>
            </Link>
            <SocialSidebar />
            <form action={signOut}>
                <Button variant="outline" className="text-zinc-200 border-zinc-700 bg-transparent hover:bg-zinc-800 hover:text-white">Logout</Button>
            </form>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Main Focus Controller takes up 2 columns */}
            <div className="md:col-span-2">
                <FocusController initialSession={currentSession} />
            </div>

            {/* Placeholder Widgets */}
            <div className="h-64 bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 flex items-center justify-center text-zinc-600 border-dashed">
                Stats Check
            </div>
        </div>
      </div>
    </div>
  )
}
