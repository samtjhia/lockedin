import { Suspense } from 'react'
import { HistoryCalendar } from '@/components/history/history-calendar'
import { getHistoryPageData } from '@/app/actions/history'

export default async function HistoryPage() {
  // Fetch calendar data AND initial month stats in parallel
  const { calendarData, initialStats } = await getHistoryPageData()

  return (
    <div className="container mx-auto p-3 sm:p-4 md:p-8 space-y-4 sm:space-y-6 md:space-y-8">
      <div className="grid gap-4 sm:gap-6">
        <Suspense fallback={<div className="text-zinc-500">Loading history...</div>}>
          <HistoryCalendar initialData={calendarData} initialStats={initialStats} />
        </Suspense>
      </div>
    </div>
  )
}
