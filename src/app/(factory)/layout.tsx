import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, CalendarDays, Trophy } from 'lucide-react'
import { SocialSidebar } from '@/components/social/social-sidebar'
import { FeedbackModal } from '@/components/feedback/feedback-modal'
import { Button } from '@/components/ui/button'
import { ProfileMenu } from '@/components/profile/profile-menu'

export default async function FactoryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_verified')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_verified) {
    redirect('/gate')
  }

  return (
    <div className="flex min-h-screen flex-col bg-black text-zinc-50">
        <header className="border-b border-zinc-800 px-6 py-3 sticky top-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-between gap-6">
          <div className="flex items-center gap-6 min-w-0">
            <div className="flex items-center">
              <h1 className="font-mono font-bold tracking-tight text-zinc-100">LOCKED IN FACTORY</h1>
            </div>
                
            <nav className="hidden md:flex items-center gap-1">
              <Link 
                href="/dashboard" 
                className="px-3 py-1.5 text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-md transition-all flex items-center gap-2"
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
              <Link 
                href="/history" 
                className="px-3 py-1.5 text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-md transition-all flex items-center gap-2"
              >
                <CalendarDays className="w-4 h-4" />
                History
              </Link>
              <Link 
                href="/" 
                className="px-3 py-1.5 text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-md transition-all flex items-center gap-2"
              >
                <Trophy className="w-4 h-4" />
                Leaderboard
              </Link>
            </nav>
          </div>
            
          <div className="flex items-center gap-2">
            <FeedbackModal />
            <SocialSidebar />
            <ProfileMenu />
          </div>
        </header>
        <main className="flex-1">
            {children}
        </main>
    </div>
  )
}
