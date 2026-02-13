import { getLeaderboardData, getLeaderboardHeatmaps } from '@/app/actions'
import { LedgerBoard } from '@/components/home/ledger-board'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const initialData = await getLeaderboardData('daily')
  
  const formattedData = (initialData || []).map((entry: any) => ({
    ...entry,
    total_seconds: Number(entry.total_seconds)
  }))

  // Fetch heatmaps for all users in parallel
  const userIds = formattedData.map((e: any) => e.user_id)
  const initialHeatmaps = await getLeaderboardHeatmaps(userIds)

  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-muted">
      <div className="container mx-auto px-4 py-8 md:py-16">
         <LedgerBoard initialData={formattedData} initialHeatmaps={initialHeatmaps} />
      </div>
    </main>
  )
}
