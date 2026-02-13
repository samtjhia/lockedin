import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, CalendarDays } from 'lucide-react'

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
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-50">
        <header className="border-b border-zinc-800 px-6 py-3 sticky top-0 bg-zinc-950/80 backdrop-blur-md z-50 flex items-center justify-between">
            <div className="flex items-center gap-8">
                <div className="flex items-center gap-2">
                    <h1 className="font-mono font-bold tracking-tight text-zinc-100">LOCKED IN</h1>
                    <span className="text-[10px] font-mono bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded border border-green-500/20">FACTORY</span>
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
                </nav>
            </div>
            
            <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-mono text-zinc-500">SYSTEM ONLINE</span>
            </div>
        </header>
        <main className="flex-1">
            {children}
        </main>
    </div>
  )
}
