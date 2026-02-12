'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { getLeaderboardData, getUserTopTasks } from '@/app/actions'
import { calculateGrade, formatDuration, cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Zap, LayoutDashboard, LogIn, Crown, Medal, ChevronDown, ChevronUp, Clock } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { User } from '@supabase/supabase-js'

type LeaderboardEntry = {
  user_id: string
  username: string
  avatar_url: string | null
  current_status: 'active' | 'paused' | 'offline'
  current_task: string | null
  total_seconds: number
  is_verified: boolean
}


type TaskStat = {
    task_name: string
    total_seconds: number
}

function LeaderboardRow({ 
    userEntry, 
    index, 
    period,
    isActive 
}: { 
    userEntry: LeaderboardEntry, 
    index: number, 
    period: 'daily' | 'weekly',
    isActive: boolean
}) {
    const [expanded, setExpanded] = useState(false)
    const [stats, setStats] = useState<TaskStat[] | null>(null)
    const [loadingStats, setLoadingStats] = useState(false)

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
      if (index === 1) return "text-zinc-300 drop-shadow-[0_0_10px_rgba(212,212,216,0.3)]" 
      if (index === 2) return "text-amber-700 drop-shadow-[0_0_10px_rgba(180,83,9,0.3)]" 
      return "text-zinc-600"
    }

    return (
        <div className={cn(
            "flex flex-col rounded-xl border transition-all duration-200", 
            isActive 
              ? "bg-green-950/5 border-green-500/20 shadow-[0_0_20px_-10px_rgba(34,197,94,0.1)]" 
              : "bg-zinc-900/20 border-zinc-800/50",
            expanded 
                ? "bg-zinc-900/80 border-zinc-700 shadow-xl ring-1 ring-white/5" 
                : "hover:bg-zinc-900/40 hover:border-zinc-700/50"
        )}>
            <div 
                onClick={toggleExpand}
                className="flex items-center gap-4 p-4 cursor-pointer select-none"
            >
                {/* Rank */}
                <div className={`w-8 text-center font-mono font-bold text-lg flex justify-center ${getRankStyle(index)}`}>
                    {index === 0 ? <Crown size={20} className="fill-yellow-400 stroke-yellow-500" /> : 
                        index === 1 ? <Medal size={20} className="fill-zinc-300 stroke-zinc-400" /> :
                        index === 2 ? <Medal size={20} className="fill-amber-700 stroke-amber-800" /> :
                        `#${index + 1}`}
                </div>

                {/* User Info */}
                <div className="flex items-center gap-4 flex-1">
                        <Avatar className="h-10 w-10 border border-zinc-800">
                        <AvatarImage src={userEntry.avatar_url || ''} />
                        <AvatarFallback className="bg-zinc-950 text-zinc-500 font-bold">
                            {userEntry.username?.[0]?.toUpperCase() || '?'}
                        </AvatarFallback>
                        </Avatar>
                        
                        <div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-zinc-200">
                                {userEntry.username || 'Anonymous'}
                            </span>
                            {isActive && (
                                <Badge variant="outline" className="text-xs border-green-500/50 bg-green-500/10 text-green-400 px-2 h-5 gap-1.5 shadow-[0_0_10px_-4px_#4ade80]">
                                    <span className="relative flex h-1.5 w-1.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                                    </span>
                                    ACTIVE
                                </Badge>
                            )}
                            {userEntry.current_status === 'paused' && (
                                <Badge variant="outline" className="text-xs border-dashed border-yellow-700/50 text-yellow-600 px-2 h-5">
                                    PAUSED
                                </Badge>
                            )}
                        </div>
                        <div className="text-xs text-zinc-500 font-mono mt-0.5 flex items-center gap-2">
                             {/* Task name truncation */}
                             <span className="max-w-[150px] md:max-w-[200px] truncate" title={userEntry.current_task || 'Idle'}>
                                {userEntry.current_task || 'Idle'}
                             </span>
                            {expanded ? <ChevronUp className="h-3 w-3 text-zinc-600" /> : <ChevronDown className="h-3 w-3 text-zinc-700" />}
                        </div>
                        </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6 md:gap-10">
                        <div className="text-right">
                        <div className="text-lg font-bold text-zinc-300 font-mono tracking-tight tabular-nums">
                            {formatDuration(userEntry.total_seconds)}
                        </div>
                        </div>

                        {/* Grade */}
                        <div className="flex flex-col items-center gap-1">
                        <div className="text-[10px] uppercase font-bold text-zinc-600">Grade</div>
                        <div className={`
                            flex items-center justify-center w-10 h-10 rounded-md border font-black text-xl shadow-inner
                            ${grade === 'S' ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400 shadow-indigo-500/20' : ''}
                            ${grade === 'A' ? 'bg-green-500/10 border-green-500/50 text-green-400 shadow-green-500/20' : ''}
                            ${grade === 'B' ? 'bg-blue-500/10 border-blue-500/50 text-blue-400 shadow-blue-500/20' : ''}
                            ${grade === 'C' ? 'bg-zinc-800/50 border-zinc-700 text-zinc-400' : ''}
                            ${grade === 'D' || grade === 'F' ? 'bg-zinc-900/50 border-zinc-800 text-zinc-700' : ''}
                        `}>
                            {grade}
                        </div>
                        </div>
                </div>
            </div>

            {/* Expanded Stats */}
            {expanded && (
                <div className="px-4 pb-4 md:pl-20 md:pr-10 animate-in slide-in-from-top-1 duration-200 fade-in-0">
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-zinc-800 to-transparent mb-4" />
                    
                    <div className="flex items-center justify-between mb-2">
                         <h4 className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            Top Activities ({period})
                         </h4>
                    </div>
                    
                    {loadingStats ? (
                        <div className="py-2 flex items-center gap-2 text-zinc-600 text-sm font-mono">
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-500"></span>
                            Fetching details...
                        </div>
                    ) : stats && stats.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {stats.map((stat, i) => (
                                <div key={i} className="flex flex-col p-2 rounded bg-zinc-950/30 border border-zinc-800/50">
                                    <div className="text-xs text-zinc-400 truncate font-medium mb-1" title={stat.task_name}>{stat.task_name}</div>
                                    <div className="text-sm font-mono font-bold text-zinc-300">
                                        {formatDuration(stat.total_seconds)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-2 text-zinc-600 text-sm italic flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-zinc-700"></div>
                            No specific tasks recorded
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export function LedgerBoard({ initialData }: { initialData: LeaderboardEntry[] }) {
  const [data, setData] = useState<LeaderboardEntry[]>(initialData)
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
    <div className="w-full max-w-4xl mx-auto space-y-8">
      {/* Header Stats */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 pb-6 border-b border-zinc-800">
        <div>
            <h1 className="text-4xl font-black tracking-tighter text-white mb-2 font-mono">
                LEADERBOARD
            </h1>
            <div className="flex items-center gap-2 text-zinc-400 font-mono text-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                LIVE STATUS
            </div>
        </div>

        <div className="flex flex-col items-end gap-2">
            <div className="text-right">
                <div className="text-sm text-zinc-500 font-mono uppercase tracking-widest">Community Time ({period})</div>
                <div className="text-3xl font-bold text-white font-mono min-w-[200px] text-right">
                    {formatDuration(totalSecondSum)}
                </div>
            </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
         <Tabs value={period} onValueChange={(v) => setPeriod(v as any)} className="w-[400px]">
            <TabsList className="bg-zinc-900 border border-zinc-800">
                <TabsTrigger value="daily" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-500">
                    Today
                </TabsTrigger>
                <TabsTrigger value="weekly" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-500">
                    This Week
                </TabsTrigger>
            </TabsList>
         </Tabs>

         <Link href={user ? "/dashboard" : "/login"}>
             <Button variant="outline" className="border-zinc-700 bg-transparent hover:bg-zinc-900 hover:text-white transition-colors">
                {user ? (
                    <>
                        <LayoutDashboard className="mr-2 h-4 w-4 text-zinc-400" />
                        Open Dashboard
                    </>
                ) : (
                    <>
                        <LogIn className="mr-2 h-4 w-4 text-zinc-400" />
                        Log In
                    </>
                )}
             </Button>
         </Link>
      </div>

      {/* Leaderboard Table */}
      <div className={`space-y-1 transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>
         {data.length === 0 ? (
             <div className="text-center py-20 text-zinc-600 font-mono border border-dashed border-zinc-800 rounded-lg">
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
                    />
                )
            })
         )}
      </div>
    </div>
  )
}