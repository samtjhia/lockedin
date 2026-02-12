import { createClient } from '@/utils/supabase/server'
import { signOut } from '../../login/actions'
import { Button } from '@/components/ui/button'

export default async function Dashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user?.id)
    .single()

  return (
    <div className="p-8">
      <div className="grid gap-6">
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-lg flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold mb-2">Welcome Back, {profile?.username}</h2>
            <p className="text-zinc-400">Station Status: <span className="text-zinc-500">Idle</span></p>
          </div>
          <form action={signOut}>
            <Button variant="outline">Logout</Button>
          </form>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Placeholder Widgets */}
            <div className="h-64 bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 flex items-center justify-center text-zinc-600 border-dashed">
                Timer Widget Check
            </div>
            <div className="h-64 bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 flex items-center justify-center text-zinc-600 border-dashed">
                Social Feed Check
            </div>
            <div className="h-64 bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 flex items-center justify-center text-zinc-600 border-dashed">
                Stats Check
            </div>
        </div>
      </div>
    </div>
  )
}
