import { Suspense } from 'react'
import { HistoryCalendar } from '@/components/history/history-calendar'
import { getHistoryCalendarData } from '@/app/actions/history'

export default async function HistoryPage() {
  const calendarData = await getHistoryCalendarData()

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">History</h1>
        <p className="text-zinc-400">Track your daily grind and session logs.</p>
      </div>

      <div className="grid gap-6">
        <Suspense fallback={<div className="text-zinc-500">Loading history...</div>}>
          <HistoryCalendar initialData={calendarData} />
        </Suspense>
      </div>
    </div>
  )
}
