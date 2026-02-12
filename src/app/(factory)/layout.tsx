import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

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
        {/* Placeholder for future sidebar/nav */}
        <header className="border-b border-zinc-900 p-4 sticky top-0 bg-zinc-950/80 backdrop-blur z-10">
            <h1 className="font-mono font-bold tracking-tight text-zinc-400">LOCKED IN FACTORY <span className="text-green-500 text-xs ml-2">● ONLINE</span></h1>
        </header>
        <main className="flex-1">
            {children}
        </main>
    </div>
  )
}
