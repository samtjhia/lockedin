'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { getLeaderboardData, getUserTopTasks, getLeaderboardHeatmaps } from '@/app/actions'
import { calculateGrade, formatDuration, cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Zap, LayoutDashboard, LogIn, Crown, Medal, ChevronDown, ChevronUp, Clock } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { User } from '@supabase/supabase-js'
import { MiniHeatmap } from './mini-heatmap'

type LeaderboardEntry = {
  user_id: string
  username: string
  avatar_url: string | null
  current_status: 'active' | 'paused' | 'offline'
  current_task: string | null
  total_seconds: number
  is_verified: boolean
}

type HeatmapData = {
  date: string
  count: number
  level: number
}


type TaskStat = {
    task_name: string
    total_seconds: number
    started_at: string | null
}

function LeaderboardRow({ 
    userEntry, 
    index, 
    period,
    isActive,
    heatmapData
}: { 
    userEntry: LeaderboardEntry, 
    index: number, 
    period: 'daily' | 'weekly',
    isActive: boolean,
    heatmapData?: HeatmapData[]
}) {
    const [expanded, setExpanded] = useState(false)
    const [stats, setStats] = useState<TaskStat[] | null>(null)
    const [loadingStats, setLoadingStats] = useState(false)

    // Reset stats and collapse when period changes (e.g. Daily <-> Weekly switch)
    useEffect(() => {
        setStats(null)
        setExpanded(false)
    }, [period])

    const grade = calculateGrade(userEntry.total_seconds, period)
    const isTop3 = index < 3

    const toggleExpand = async () => {
        if (!expanded && !stats) {
            setLoadingStats(true)
            const data = await getUserTopTasks(userEntry.user_id, period)
            setStats(data)
            setLoadingStats(false)
        }
        setExpanded(!expanded)
    }

      // Rank Styling Helper
    const getRankStyle = (index: number) => {
      if (index === 0) return "text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]" 
      if (index === 1) return "text-foreground/70 drop-shadow-[0_0_10px_rgba(212,212,216,0.3)]" 
      if (index === 2) return "text-amber-700 drop-shadow-[0_0_10px_rgba(180,83,9,0.3)]" 
      return "text-muted-foreground"
    }

    return (
        <div className={cn(
            "flex flex-col rounded-xl border transition-all duration-200", 
            isActive 
              ? "bg-green-950/5 border-green-500/20 shadow-[0_0_20px_-10px_rgba(34,197,94,0.1)]" 
              : "bg-card/20 border-border/50",
            expanded 
                ? "bg-card/80 border-border shadow-xl ring-1 ring-white/5" 
                : "hover:bg-card/40 hover:border-border/50"
        )}>
            <div 
                onClick={toggleExpand}
                className="flex items-center gap-2 sm:gap-3 md:gap-4 p-3 sm:p-4 cursor-pointer select-none"
            >
                {/* Rank */}
                <div className={`w-6 sm:w-8 text-center font-mono font-bold text-sm sm:text-lg flex justify-center shrink-0 ${getRankStyle(index)}`}>
                    {index === 0 ? <Crown size={18} className="sm:w-5 sm:h-5 fill-yellow-400 stroke-yellow-500" /> : 
                        index === 1 ? <Medal size={18} className="sm:w-5 sm:h-5 fill-zinc-300 stroke-zinc-400" /> :
                        index === 2 ? <Medal size={18} className="sm:w-5 sm:h-5 fill-amber-700 stroke-amber-800" /> :
                        `#${index + 1}`}
                </div>

                {/* User Info */}
                <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0">
                        <Avatar className="h-8 w-8 sm:h-10 sm:w-10 border border-border shrink-0">
                        <AvatarImage src={userEntry.avatar_url || ''} />
                        <AvatarFallback className="bg-background text-muted-foreground font-bold text-xs sm:text-sm">
                            {userEntry.username?.[0]?.toUpperCase() || '?'}
                        </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <span className="font-bold text-foreground text-sm sm:text-base truncate">
                                {userEntry.username || 'Anonymous'}
                            </span>
                            {isActive && (
                                <Badge variant="outline" className="text-[10px] sm:text-xs border-green-500/50 bg-green-500/10 text-green-400 px-1.5 sm:px-2 h-4 sm:h-5 gap-1 sm:gap-1.5 shadow-[0_0_10px_-4px_#4ade80]">
                                    <span className="relative flex h-1.5 w-1.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                                    </span>
                                    ACTIVE
                                </Badge>
                            )}
                            {userEntry.current_status === 'paused' && (
                                <Badge variant="outline" className="text-[10px] sm:text-xs border-dashed border-yellow-700/50 text-yellow-600 px-1.5 sm:px-2 h-4 sm:h-5">
                                    PAUSED
                                </Badge>
                            )}
                        </div>
                        <div className="text-[10px] sm:text-xs text-muted-foreground font-mono mt-0.5 flex items-center gap-1.5 sm:gap-2">
                             {/* Task name truncation */}
                             <span className="max-w-[100px] sm:max-w-[150px] md:max-w-[200px] truncate" title={userEntry.current_task || 'Idle'}>
                                {userEntry.current_task || 'Idle'}
                             </span>
                            {expanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                        </div>
                        </div>

                </div>

                {/* Mini Heatmap - responsive: 26 weeks on lg, 52 on xl */}
                {heatmapData && (
                    <>
                        <div className="hidden lg:flex xl:hidden items-center">
                            <MiniHeatmap data={heatmapData} weeks={26} />
                        </div>
                        <div className="hidden xl:flex items-center">
                            <MiniHeatmap data={heatmapData} weeks={52} />
                        </div>
                    </>
                )}

                {/* Stats: Time + Grade */}
                <div className="flex items-center gap-2 sm:gap-3 md:gap-4 shrink-0">
                        {/* Grade */}
                        <div 
                            title="Grade"
                            className={`
                                flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-md sm:rounded-lg font-black text-sm sm:text-lg md:text-xl cursor-default
                                ${grade === 'S' ? 'bg-gradient-to-br from-indigo-500/30 to-purple-500/20 text-indigo-300 ring-1 ring-indigo-400/50' : ''}
                                ${grade === 'A' ? 'bg-gradient-to-br from-green-500/30 to-emerald-500/20 text-green-300 ring-1 ring-green-400/50' : ''}
                                ${grade === 'B' ? 'bg-gradient-to-br from-blue-500/30 to-cyan-500/20 text-blue-300 ring-1 ring-blue-400/50' : ''}
                                ${grade === 'C' ? 'bg-gradient-to-br from-yellow-500/20 to-amber-500/10 text-yellow-400 ring-1 ring-yellow-500/40' : ''}
                                ${grade === 'D' ? 'bg-gradient-to-br from-orange-500/20 to-red-500/10 text-orange-400 ring-1 ring-orange-500/40' : ''}
                                ${grade === 'F' ? 'bg-gradient-to-br from-red-500/20 to-red-900/10 text-red-400 ring-1 ring-red-500/40' : ''}
                            `}
                        >
                            {grade}
                        </div>

                        {/* Time */}
                        <div className="text-right">
                            <div className="text-xs sm:text-base md:text-lg font-bold text-foreground font-mono tracking-tight tabular-nums">
                                {formatDuration(userEntry.total_seconds)}
                            </div>
                        </div>
                </div>
            </div>

            {/* Expanded Stats */}
            {expanded && (
                <div className="px-3 pb-3 sm:px-4 sm:pb-4 md:pl-20 md:pr-10 animate-in slide-in-from-top-1 duration-200 fade-in-0">
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-zinc-800 to-transparent mb-3 sm:mb-4" />
                    
                    <div className="flex items-center justify-between mb-2">
                         <h4 className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            {period === 'weekly' ? 'Top Activities' : 'Daily Schedule'} ({period})
                         </h4>
                    </div>
                    
                    {loadingStats ? (
                        <div className="py-2 flex items-center gap-2 text-muted-foreground text-xs sm:text-sm font-mono">
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-border border-t-zinc-500"></span>
                            Fetching details...
                        </div>
                    ) : stats && stats.length > 0 ? (
                        period === 'daily' ? (
                            // Daily Schedule View
                            <div className="space-y-1 sm:space-y-2">
                                {stats.map((stat, i) => {
                                    // Fallback if started_at is missing (e.g. migration not run)
                                    const timeStr = stat.started_at 
                                        ? new Date(stat.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                        : '--:--'
                                    
                                    return (
                                        <div key={i} className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm group/row p-1.5 sm:p-2 rounded hover:bg-muted/30 border border-transparent hover:border-border/50 transition-colors">
                                            <div className="font-mono text-muted-foreground text-[10px] sm:text-xs w-12 sm:w-16 shrink-0">
                                                {timeStr}
                                            </div>
                                            <div className="flex-1 truncate font-medium text-foreground/70">
                                                {stat.task_name}
                                            </div>
                                            <div className="font-mono text-muted-foreground text-[10px] sm:text-xs tabular-nums group-hover/row:text-foreground/70">
                                                {formatDuration(stat.total_seconds)}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            // Weekly Top 3 Grid
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                                {stats.slice(0, 3).map((stat, i) => (
                                    <div key={i} className="flex flex-col p-2 rounded bg-muted/30 border border-border/50">
                                        <div className="text-xs text-muted-foreground truncate font-medium mb-1" title={stat.task_name}>{stat.task_name}</div>
                                        <div className="text-xs sm:text-sm font-mono font-bold text-foreground/70">
                                            {formatDuration(stat.total_seconds)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        <div className="py-2 text-muted-foreground text-xs sm:text-sm italic flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-border"></div>
                            No specific tasks recorded
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

type LedgerBoardProps = {
  initialData: LeaderboardEntry[]
  initialHeatmaps?: Record<string, HeatmapData[]>
}

export function LedgerBoard({ initialData, initialHeatmaps }: LedgerBoardProps) {
  const [data, setData] = useState<LeaderboardEntry[]>(initialData)
  const [heatmaps, setHeatmaps] = useState<Record<string, HeatmapData[]>>(initialHeatmaps || {})
  const [period, setPeriod] = useState<'daily' | 'weekly'>('daily')
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  
  const supabase = createClient()

  // 1. Check Auth 
  useEffect(() => {
      supabase.auth.getUser().then(({ data }) => {
          setUser(data.user)
      })
  }, [])

  const fetchData = async () => {
    // Re-fetch data helper
    const newData = await getLeaderboardData(period)
    
    const formattedData = (newData || []).map((entry: any) => ({
        ...entry,
        total_seconds: Number(entry.total_seconds)
    }))
    
    setData(formattedData)
    
    // Fetch heatmaps for new users
    const userIds = formattedData.map((e: LeaderboardEntry) => e.user_id)
    const newHeatmaps = await getLeaderboardHeatmaps(userIds)
    setHeatmaps(newHeatmaps)
  }

  // 2. Fetch data on period switch
  useEffect(() => {
    const run = async () => {
        setLoading(true)
        await fetchData()
        setLoading(false)
    }
    
    if (period !== 'daily' || data !== initialData) { 
        run()
    }
  }, [period])

  // 3. Realtime & Ticker
  useEffect(() => {
    // A. Postgres Subscription
    const channel = supabase
      .channel('ledger_realtime')
      .on(
        'postgres_changes',
        {
          event: '*', 
          schema: 'public',
          table: 'profiles',
        },
        () => {
           // On ANY profile change, re-fetch logic to ensure stats/status correctness
           fetchData()
        }
      )
      .subscribe()

    // B. Local Ticker for Active Users
    const ticker = setInterval(() => {
        setData(current => current.map(u => {
            if (u.current_status === 'active') {
                return { ...u, total_seconds: u.total_seconds + 1 }
            }
            return u
        }))
    }, 1000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(ticker)
    }
  }, [period])

  const totalSecondSum = data.reduce((acc, curr) => acc + (curr.total_seconds || 0), 0)

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 sm:space-y-6 md:space-y-8">
      {/* Header Stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-6 border-b border-border">
        <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-2">
                Leaderboard
            </h1>
            <div className="flex items-center gap-2 text-muted-foreground font-mono text-xs sm:text-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                LIVE STATUS
            </div>
        </div>

        <div className="flex flex-col items-start md:items-end gap-2 w-full md:w-auto">
            <div className="md:text-right">
                <div className="text-xs sm:text-sm text-muted-foreground font-mono uppercase tracking-widest">Community Time ({period})</div>
                <div className="text-2xl sm:text-3xl font-bold text-foreground font-mono">
                    {formatDuration(totalSecondSum)}
                </div>
            </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3">
         <Tabs value={period} onValueChange={(v) => setPeriod(v as any)} className="w-auto">
            <TabsList className="bg-card border border-border">
                <TabsTrigger value="daily" className="data-[state=active]:bg-muted data-[state=active]:text-foreground text-muted-foreground text-xs sm:text-sm px-3 sm:px-4">
                    Today
                </TabsTrigger>
                <TabsTrigger value="weekly" className="data-[state=active]:bg-muted data-[state=active]:text-foreground text-muted-foreground text-xs sm:text-sm px-3 sm:px-4">
                    This Week
                </TabsTrigger>
            </TabsList>
         </Tabs>

         <Link href={user ? "/dashboard" : "/login"}>
             <Button variant="outline" className="border-border bg-transparent hover:bg-card hover:text-foreground transition-colors text-xs sm:text-sm">
                {user ? (
                    <>
                        <LayoutDashboard className="mr-1.5 sm:mr-2 h-4 w-4 text-muted-foreground" />
                        <span className="hidden sm:inline">Open Dashboard</span>
                        <span className="sm:hidden">Dashboard</span>
                    </>
                ) : (
                    <>
                        <LogIn className="mr-1.5 sm:mr-2 h-4 w-4 text-muted-foreground" />
                        Log In
                    </>
                )}
             </Button>
         </Link>
      </div>

      {/* Leaderboard Table */}
      <div className={`space-y-1 transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>
         {data.length === 0 ? (
             <div className="text-center py-12 sm:py-20 text-muted-foreground font-mono text-xs sm:text-sm border border-dashed border-border rounded-lg">
                NO DATA RECORDED FOR THIS PERIOD
             </div>
         ) : (
            data.map((user, index) => {
                const isActive = user.current_status === 'active'
                return (
                    <LeaderboardRow 
                        key={user.user_id} 
                        userEntry={user} 
                        index={index} 
                        period={period}
                        isActive={isActive}
                        heatmapData={heatmaps[user.user_id]}
                    />
                )
            })
         )}
      </div>
    </div>
  )
}