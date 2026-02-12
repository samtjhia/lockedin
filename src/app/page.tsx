import { getLeaderboardData } from '@/app/actions'
import { LedgerBoard } from '@/components/home/ledger-board'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const initialData = await getLeaderboardData('daily')
  
  const formattedData = (initialData || []).map((entry: any) => ({
    ...entry,
    total_seconds: Number(entry.total_seconds)
  }))

  return (
    <main className="min-h-screen bg-black text-zinc-100 selection:bg-zinc-800">
      <div className="container mx-auto px-4 py-8 md:py-16">
         <LedgerBoard initialData={formattedData} />
      </div>
    </main>
  )
}
