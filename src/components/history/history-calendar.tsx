'use client'

import { useState, useMemo, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import { format, isFuture, isSameDay, startOfMonth } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { getDayLogs, getHistoryStats } from '@/app/actions/history'
import { formatDuration, calculateGrade } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Loader2, Calendar as CalendarIcon, Clock, CheckCircle2, TrendingUp, Trophy, Zap, Hourglass, BarChart3, Flame } from 'lucide-react'
import 'react-day-picker/dist/style.css'

// Custom CSS to override DayPicker styles for dark theme
const rdpStyles = `
  .rdp-root {
    --rdp-accent-color: #22c55e; /* Green-500 */
    --rdp-background-color: transparent;
    margin: 0;
  }
  .rdp-day_selected {
    background-color: #22c55e !important;
    color: #000000 !important;
    font-weight: 700 !important;
    border-radius: 6px !important;
  }
  .rdp-day_selected:hover {
    background-color: #16a34a !important; /* Green-600 */
  }
  .rdp-day_today {
    color: #22c55e !important;
    font-weight: 700;
  }
  
  /* Markers for activity density */
  .rdp-day_button {
    position: relative;
  }

  .rdp-day_level1 .rdp-day_button::after,
  .rdp-day_level2 .rdp-day_button::after, 
  .rdp-day_level3 .rdp-day_button::after, 
  .rdp-day_level4 .rdp-day_button::after {
    display: block;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    margin-top: 2px;
    content: '';
    position: absolute;
    bottom: 2px;
    left: 50%;
    transform: translateX(-50%);
  }
  
  .rdp-day_level1 .rdp-day_button::after { background-color: #15803d; opacity: 0.6; }
  .rdp-day_level2 .rdp-day_button::after { background-color: #15803d; opacity: 0.8; }
  .rdp-day_level3 .rdp-day_button::after { background-color: #22c55e; opacity: 0.9; }
  .rdp-day_level4 .rdp-day_button::after { background-color: #4ade80; opacity: 1.0; }

  /* Hide dot on selected day */
  .rdp-day_selected .rdp-day_button::after { display: none; }
  
  /* Dropdown Styles */
  .rdp-caption_dropdowns {
    display: flex;
    justify-content: center;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .rdp-dropdown_year, .rdp-dropdown_month {
    position: relative;
    display: inline-block;
  }

  /* Target the select element directly */
  select.rdp-dropdown {
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    background-color: #27272a; /* zinc-800 */
    border: 1px solid #3f3f46; /* zinc-700 */
    color: #f4f4f5; /* zinc-100 */
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    min-width: 110px;
    outline: none;
    text-align: center;
  }
  
  select.rdp-dropdown:hover {
    border-color: #52525b; /* zinc-600 */
    background-color: #3f3f46; /* zinc-700 */
  }

  select.rdp-dropdown:focus {
    border-color: #22c55e; /* green-500 */
    box-shadow: 0 0 0 1px #22c55e;
  }

  /* Style options for better visibility */
  select.rdp-dropdown option {
    background-color: #18181b;
    color: #fff;
    padding: 10px;
  }

  /* Hide default nav */
  .rdp-nav { display: none; }
  
  .rdp-table {
    width: 100%;
    border-collapse: collapse;
  }

  .rdp-head_row,
  .rdp-row {
    display: table-row;
  }

  .rdp-head_cell {
    text-align: center;
    font-size: 0.75rem;
    font-weight: 500;
    color: #ffffff !important;
    text-transform: uppercase;
    padding-bottom: 10px;
    padding-top: 2px;
  }

  .rdp-cell {
    text-align: center;
  }
`

type CalendarData = {
  date: string
  count: number
  level: number
}

type DayLog = {
  id: string
  task_name: string
  status: string
  mode: string
  duration_seconds: number
  started_at: string
  ended_at: string | null
}

type Stats = {
    daily: {
        total_seconds: number
        longest_session: number
        peak_hour: number | null
        top_topics: { name: string, duration: number }[]
    }
    weekly: { total_seconds: number }
  monthly: {
    total_seconds: number
    peak_hour: number | null
    top_topics: { name: string, duration: number }[]
  }
}

export function HistoryCalendar({ initialData }: { initialData: CalendarData[] }) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date())
  const [dayLogs, setDayLogs] = useState<DayLog[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [loadingStats, setLoadingStats] = useState(false)

  // Map dates to levels for quick lookup
  const dataMap = useMemo(() => {
    const map = new Map<string, number>()
    initialData.forEach(d => {
      map.set(d.date, d.level)
    })
    return map
  }, [initialData])

  // Load logs when date changes
  useEffect(() => {
    if (selectedDate) {
      loadDayData(selectedDate)
      return
    }

    loadMonthStats(currentMonth)
  }, [selectedDate, currentMonth])

  const loadDayData = async (day: Date) => {
    setLoadingLogs(true)
    setLoadingStats(true)
    setDayLogs([])
    setStats(null)
    try {
      const dateStr = format(day, 'yyyy-MM-dd')
      const [logs, statsData] = await Promise.all([
          getDayLogs(dateStr),
          getHistoryStats(dateStr)
      ])
      setDayLogs(logs)
      setStats(statsData)
    } catch (error) {
      console.error(error)
    } finally {
      setLoadingLogs(false)
      setLoadingStats(false)
    }
  }

  const loadMonthStats = async (month: Date) => {
    setLoadingStats(true)
    setDayLogs([])
    setStats(null)
    try {
      const monthStart = startOfMonth(month)
      const dateStr = format(monthStart, 'yyyy-MM-dd')
      const statsData = await getHistoryStats(dateStr)
      setStats(statsData)
    } catch (error) {
      console.error(error)
    } finally {
      setLoadingStats(false)
    }
  }

  // Activity Modifiers
  const modifiers = {
    level1: (date: Date) => dataMap.get(format(date, 'yyyy-MM-dd')) === 1,
    level2: (date: Date) => dataMap.get(format(date, 'yyyy-MM-dd')) === 2,
    level3: (date: Date) => dataMap.get(format(date, 'yyyy-MM-dd')) === 3,
    level4: (date: Date) => dataMap.get(format(date, 'yyyy-MM-dd')) === 4,
  }

  const modifiersClassNames = {
    level1: 'rdp-day_level1',
    level2: 'rdp-day_level2',
    level3: 'rdp-day_level3',
    level4: 'rdp-day_level4',
  }

  return (
    <>
      <style>{rdpStyles}</style>
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        
        {/* Left Col: Calendar */}
        <div className="w-full lg:w-auto">
          <Card className="border-zinc-800 bg-zinc-950/50 inline-block w-full lg:w-auto">
            <CardContent className="p-6 flex justify-center">
              <DayPicker
                mode="single"
                selected={selectedDate}
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                onSelect={(date) => {
                  if (!date) {
                    setSelectedDate(undefined)
                    return
                  }

                  if (selectedDate && isSameDay(date, selectedDate)) {
                    setSelectedDate(undefined)
                    return
                  }

                  setSelectedDate(date)
                  setCurrentMonth(date)
                }}
                modifiers={modifiers}
                modifiersClassNames={modifiersClassNames}
                captionLayout="dropdown" 
                fromYear={2024} 
                toYear={2030}
                classNames={{
                    day_selected: "bg-green-500 text-black font-bold hover:bg-green-600 rounded-md", 
                    day_today: "text-green-500 font-bold",
                    caption_label: "hidden", // Hide default label as we use dropdowns
                    caption_dropdowns: "flex gap-4 items-center justify-center p-2 mb-4",
                    dropdown: "bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-md p-2 text-sm focus:border-green-500 focus:ring-green-500 shadow-sm transition-all",
                    head_cell: "text-white font-medium pb-4 text-xs uppercase tracking-widest opacity-100",
                    weekday: "text-white font-medium pb-4 text-xs uppercase tracking-widest opacity-100",
                    table: "w-full border-collapse",
                    row: "h-9",
                    cell: "p-0 text-center",
                    day: "h-9 w-9 p-0 font-medium aria-selected:opacity-100 hover:bg-zinc-800 rounded-md transition-all text-sm text-zinc-200",
                }}
              />
            </CardContent>
          </Card>

          {/* Legend */}
          <div className="mt-6 bg-zinc-900/30 p-4 rounded-lg border border-zinc-800/50 md:max-w-[350px]">
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Activity Levels</h3>
            <div className="flex items-center justify-between text-xs text-zinc-600">
                <span>Less</span>
                <div className="flex gap-2">
                    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-transparent border border-zinc-800" title="0 sessions">
                        <span className="text-zinc-500">22</span>
                    </div>
                     <div className="flex flex-col items-center justify-center w-8 h-8 rounded-md bg-transparent border border-zinc-700" title="Level 1">
                        <span className="text-zinc-300">23</span>
                        <div className="w-1 h-1 rounded-full bg-green-800 opacity-50 mt-0.5"></div>
                    </div>
                     <div className="flex flex-col items-center justify-center w-8 h-8 rounded-md bg-transparent border border-zinc-700" title="Level 4">
                        <span className="text-zinc-300">24</span>
                        <div className="w-1 h-1 rounded-full bg-green-400 mt-0.5"></div>
                    </div>
                </div>
                <span>More</span>
            </div>
             <p className="text-[10px] text-zinc-500 mt-3 text-center">
                Dots indicate completed sessions per day.
            </p>
          </div>
        </div>

        {/* Right Col: Details Panel */}
        <div className="flex-1 w-full h-[600px] lg:h-[650px] bg-zinc-950/30 rounded-xl border border-zinc-800/50 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/20 rounded-t-xl shrink-0">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-zinc-900 flex items-center justify-center border border-zinc-800 shadow-inner">
                        <CalendarIcon className="h-6 w-6 text-green-500" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-zinc-100 mb-1">
                     {selectedDate ? format(selectedDate, 'EEE, MMM do') : format(currentMonth, 'MMMM yyyy')}
                        </h2>
                        <div className="flex items-center gap-2">
                    {stats && (
                      selectedDate ? (
                        <div className={`px-2 py-0.5 rounded text-xs font-bold border ${
                          calculateGrade(stats.daily.total_seconds) === 'S' ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400' :
                          calculateGrade(stats.daily.total_seconds) === 'A' ? 'bg-green-500/10 border-green-500/50 text-green-400' :
                          calculateGrade(stats.daily.total_seconds) === 'B' ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' :
                          'bg-zinc-800 text-zinc-400 border-zinc-700'
                        }`}>
                          GRADE: {calculateGrade(stats.daily.total_seconds)}
                        </div>
                      ) : (
                        <div className={`px-2 py-0.5 rounded text-xs font-bold border ${
                          calculateGrade(stats.monthly.total_seconds, 'monthly') === 'S' ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400' :
                          calculateGrade(stats.monthly.total_seconds, 'monthly') === 'A' ? 'bg-green-500/10 border-green-500/50 text-green-400' :
                          calculateGrade(stats.monthly.total_seconds, 'monthly') === 'B' ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' :
                          'bg-zinc-800 text-zinc-400 border-zinc-700'
                        }`}>
                          MONTH GRADE: {calculateGrade(stats.monthly.total_seconds, 'monthly')}
                        </div>
                      )
                    )}
                            <p className="text-xs text-zinc-400">
                      {selectedDate 
                        ? (loadingLogs ? 'Loading...' : `${dayLogs.length} sessions`) 
                        : (loadingStats ? 'Loading...' : 'Month overview')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Stats Grid */}
            {stats && selectedDate && (
              <div className="grid grid-cols-4 gap-3 px-4 pt-4 animate-in slide-in-from-top-2 shrink-0">
                     {/* Daily Grade */}
                     <div className="bg-zinc-900/40 p-3 rounded-xl border border-zinc-800/50 flex flex-col gap-1">
                        <div className="text-[10px] uppercase font-bold text-zinc-400 flex items-center gap-1.5">
                            <CalendarIcon className="h-3.5 w-3.5" /> Day
                        </div>
                        <div className="text-2xl font-black text-zinc-200">
                             {isFuture(selectedDate) || stats.daily.total_seconds === 0 ? '--' : calculateGrade(stats.daily.total_seconds)}
                        </div>
                    </div>
                     {/* Weekly Grade */}
                    <div className="bg-zinc-900/40 p-3 rounded-xl border border-zinc-800/50 flex flex-col gap-1">
                        <div className="text-[10px] uppercase font-bold text-zinc-400 flex items-center gap-1.5">
                            <TrendingUp className="h-3.5 w-3.5" /> Week
                        </div>
                        <div className="text-2xl font-black text-zinc-200">
                            {isFuture(selectedDate) || stats.weekly.total_seconds === 0 ? '--' : calculateGrade(stats.weekly.total_seconds, 'weekly')}
                        </div>
                    </div>
                     {/* Monthly Grade */}
                    <div className="bg-zinc-900/40 p-3 rounded-xl border border-zinc-800/50 flex flex-col gap-1">
                        <div className="text-[10px] uppercase font-bold text-zinc-400 flex items-center gap-1.5">
                            <BarChart3 className="h-3.5 w-3.5" /> Month
                        </div>
                        <div className="text-2xl font-black text-zinc-200">
                            {isFuture(selectedDate) || stats.monthly.total_seconds === 0 ? '--' : calculateGrade(stats.monthly.total_seconds, 'monthly')}
                        </div>
                    </div>
                     {/* Peak Hour */}
                    <div className="bg-zinc-900/40 p-3 rounded-xl border border-zinc-800/50 flex flex-col gap-1">
                        <div className="text-[10px] uppercase font-bold text-zinc-400 flex items-center gap-1.5">
                            <Zap className="h-3.5 w-3.5" /> Peak
                        </div>
                        <div className="text-lg font-bold text-zinc-200 mt-0.5">
                            {stats.daily.peak_hour !== null ? (() => {
                                const h = stats.daily.peak_hour;
                                const ampm = h >= 12 ? 'pm' : 'am';
                                const displayH = h % 12 || 12;
                                return `${displayH}${ampm}`;
                            })() : '--'}
                        </div>
                    </div>
                </div>
            )}

                {stats && !selectedDate && (
                  <div className="grid grid-cols-2 gap-3 px-4 pt-4 animate-in slide-in-from-top-2 shrink-0">
                    <div className="bg-zinc-900/40 p-3 rounded-xl border border-zinc-800/50 flex flex-col gap-1">
                      <div className="text-[10px] uppercase font-bold text-zinc-400 flex items-center gap-1.5">
                        <BarChart3 className="h-3.5 w-3.5" /> Month
                      </div>
                      <div className="text-2xl font-black text-zinc-200">
                        {calculateGrade(stats.monthly.total_seconds, 'monthly')}
                      </div>
                    </div>
                    <div className="bg-zinc-900/40 p-3 rounded-xl border border-zinc-800/50 flex flex-col gap-1">
                      <div className="text-[10px] uppercase font-bold text-zinc-400 flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5" /> Peak
                      </div>
                      <div className="text-lg font-bold text-zinc-200 mt-0.5">
                        {stats.monthly.peak_hour !== null ? (() => {
                          const h = stats.monthly.peak_hour
                          const ampm = h >= 12 ? 'pm' : 'am'
                          const displayH = h % 12 || 12
                          return `${displayH}${ampm}`
                        })() : '--'}
                      </div>
                    </div>
                  </div>
                )}

            {/* Top Topics */}
                {stats && selectedDate && stats.daily.top_topics.length > 0 && (
                 <div className="px-4 pt-4 shrink-0">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase mb-2 flex items-center gap-1.5">
                        <Flame className="h-4 w-4" /> Top Focus
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {stats.daily.top_topics.map((t, i) => (
                            <div key={i} className="bg-zinc-900/60 px-2.5 py-1 rounded text-xs border border-zinc-800 flex items-center gap-2">
                                <span className="text-zinc-300 font-medium capitalize max-w-[100px] truncate">{t.name}</span>
                                <span className="text-zinc-400 border-l border-zinc-700 pl-2">{formatDuration(t.duration)}</span>
                            </div>
                        ))}
                    </div>
                 </div>
            )}

                {stats && !selectedDate && stats.monthly.top_topics.length > 0 && (
                  <div className="px-4 pt-4 shrink-0">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase mb-3 flex items-center gap-1.5">
                      <Flame className="h-4 w-4" /> Top Focus (Month)
                    </h4>
                    <div className="space-y-2">
                      {(() => {
                        const maxDuration = Math.max(...stats.monthly.top_topics.map(t => t.duration), 1)
                        return stats.monthly.top_topics.map((t, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <div className="w-24 text-xs text-zinc-300 font-medium capitalize truncate">{t.name}</div>
                            <div className="flex-1">
                              <div className="h-2 rounded-full bg-zinc-900/60 border border-zinc-800/60 overflow-hidden">
                                <div
                                  className="h-full bg-green-500/70"
                                  style={{ width: `${Math.round((t.duration / maxDuration) * 100)}%` }}
                                />
                              </div>
                            </div>
                            <div className="w-16 text-right text-[10px] text-zinc-400">
                              {formatDuration(t.duration)}
                            </div>
                          </div>
                        ))
                      })()}
                    </div>
                  </div>
                )}

            {/* Logs Header */}
            {selectedDate && (
              <div className="px-4 pt-4 pb-2 shrink-0">
                <h4 className="text-xs font-bold text-zinc-400 uppercase flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4" /> Session Log
                </h4>
              </div>
            )}

            {/* Scrollable List */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 min-h-0">
                {!selectedDate ? (
                 <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-3">
                        <CalendarIcon className="h-10 w-10 opacity-20" />
                  <p className="text-sm">Select a date to view sessions.</p>
                     </div>
                ) : loadingLogs ? (
                    <div className="h-full flex flex-col items-center justify-center gap-2 text-zinc-400">
                        <Loader2 className="h-5 w-5 animate-spin text-green-500" />
                        <p className="text-xs font-mono">Loading logs...</p>
                    </div>
                ) : dayLogs.length > 0 ? (
                    dayLogs.map((log) => (
                        <div key={log.id} className="group flex items-center gap-3 p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/50 hover:bg-zinc-900/60 hover:border-zinc-700/50 transition-all">
                            <div className="shrink-0">
                                <CheckCircle2 className="h-4 w-4 text-green-500/50 group-hover:text-green-400 transition-colors" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-zinc-200 truncate group-hover:text-white transition-colors" title={log.task_name}>
                                    {log.task_name}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono mt-0.5">
                                    <span className="flex items-center gap-1">
                                        {format(new Date(log.started_at), 'h:mm a')}
                                    </span>
                                    <span className="w-0.5 h-0.5 rounded-full bg-zinc-700" />
                                    <span className="text-zinc-300">
                                        {formatDuration(log.duration_seconds)}
                                    </span>
                                     {log.mode !== 'focus' && (
                                        <span className="bg-zinc-800/50 px-1.5 rounded text-[10px] uppercase text-zinc-400 border border-zinc-700">
                                            {log.mode}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                        <div className="w-10 h-10 rounded-full bg-zinc-900/50 flex items-center justify-center mb-3">
                            <Clock className="h-5 w-5 opacity-20" />
                        </div>
                        <p className="font-medium text-sm text-zinc-300">No sessions</p>
                    </div>
                )}
            </div>
        </div>
      </div>
    </>
  )
}
