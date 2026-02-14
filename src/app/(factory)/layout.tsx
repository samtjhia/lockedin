import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, CalendarDays, Trophy } from 'lucide-react'
import { SocialSidebar } from '@/components/social/social-sidebar'
import { FeedbackModal } from '@/components/feedback/feedback-modal'
import { SetOfflineOnLeave } from '@/components/layout/set-offline-on-leave'
import { Button } from '@/components/ui/button'
import { ProfileMenu } from '@/components/profile/profile-menu'
import { MobileNav } from '@/components/layout/mobile-nav'

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

  // Mark user as online when they're in the app (only if currently offline — don't override active/paused)
  await supabase
    .from('profiles')
    .update({ current_status: 'online', updated_at: new Date().toISOString() })
    .eq('id', user.id)
    .eq('current_status', 'offline')

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
        <SetOfflineOnLeave />
        <header className="border-b border-border px-3 sm:px-6 py-3 sticky top-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-between gap-2 sm:gap-6">
          <div className="flex items-center gap-2 sm:gap-6 min-w-0">
            {/* Mobile nav menu */}
            <MobileNav />

            <Link href="/dashboard" className="flex items-center min-w-0">
              <h1 className="font-mono font-bold tracking-tight text-foreground text-sm sm:text-base truncate hover:text-foreground transition-colors">
                <span className="hidden sm:inline">LOCKED IN FACTORY</span>
                <span className="sm:hidden">LIF</span>
              </h1>
            </Link>
                
            <nav className="hidden md:flex items-center gap-1">
              <Link 
                href="/dashboard" 
                className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-card rounded-md transition-all flex items-center gap-2"
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
              <Link 
                href="/history" 
                className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-card rounded-md transition-all flex items-center gap-2"
              >
                <CalendarDays className="w-4 h-4" />
                History
              </Link>
              <Link 
                href="/" 
                className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-card rounded-md transition-all flex items-center gap-2"
              >
                <Trophy className="w-4 h-4" />
                Leaderboard
              </Link>
            </nav>
          </div>
            
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="hidden sm:block">
              <FeedbackModal />
            </div>
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
