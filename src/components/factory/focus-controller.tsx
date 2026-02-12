'use client'

import { useState, useEffect } from 'react' // Added useEffect
import { useFactoryTimer } from '../../hooks/use-factory-timer'
import { punchIn, punchOut, pauseSession, resumeSession, transitionSession, getPomoStats } from '@/app/(factory)/actions' // Added transitionSession
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { StopCircle, Play, Timer, Clock, Pause, Coffee, Bell, BellOff, Volume2, VolumeX } from 'lucide-react'

type FocusControllerProps = {
  initialSession: any 
}

export function FocusController({ initialSession }: FocusControllerProps) {
  // Local state to track session immediately before server revalidate
  const [session, setSession] = useState(initialSession)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<string>('stopwatch')
  const [pomoCount, setPomoCount] = useState(0)

  // Settings
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [notifEnabled, setNotifEnabled] = useState(false)
  
  // Init stats & Permission
  useEffect(() => {
     getPomoStats().then(s => setPomoCount(s.count))
     if (Notification.permission === 'granted') {
        setNotifEnabled(true)
     }
  }, [])

  // Function to request notification permission
  const requestNotifPermission = async () => {
    if (!('Notification' in window)) return
    const permission = await Notification.requestPermission()
    setNotifEnabled(permission === 'granted')
  }

  // Timer hook
  const { formattedTime, isRunning, isFinished } = useFactoryTimer(
      session?.status,
      session?.last_resumed_at,
      session?.accumulated_seconds,
      session?.mode || 'stopwatch'
  )

  // Auto-transition effect
  useEffect(() => {
    if (isFinished && session?.status === 'active' && !loading) {
       // Delay to ensure user sees 00:00
       const timerId = setTimeout(async () => {
         setLoading(true)
         
         // Audio feedback
         if (soundEnabled) {
            try {
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3') 
                audio.volume = 0.5
                await audio.play()
            } catch (e) {
                console.warn('Audio playback failed', e)
            }
         }

         // Desktop Notification
         if (notifEnabled && document.hidden) {
            new Notification('Session Complete', { body: 'Time to switch context!' })
         }

         const res = await transitionSession(session.id)
         
         if (res?.stop) {
            setSession(null)
         } else if (res?.success && 'session' in res) {
            setSession(res.session)
            // @ts-ignore
            if (res.pomoSessionCount !== undefined) setPomoCount(res.pomoSessionCount)
         }
         
         setLoading(false)
       }, 1000) // 1 second delay

       return () => clearTimeout(timerId)
    }
  }, [isFinished, session?.status, session?.id, soundEnabled, notifEnabled])

  async function handleStart(formData: FormData) {
    setLoading(true)
    formData.append('mode', mode)
    
    try {
      const result = await punchIn(formData)
      if (result?.success && result.session) {
        setSession(result.session)
      } else if (result?.error) {
         console.error(result.error)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleStop() {
    if (!session?.id) return
    setLoading(true)
    await punchOut(session.id)
    setSession(null) 
    setLoading(false)
  }

  async function handlePause() {
    if (!session?.id) return
    setLoading(true)
    const res = await pauseSession(session.id)
    if (res?.success) setSession(res.session)
    setLoading(false)
  }

  async function handleResume() {
    if (!session?.id) return
    setLoading(true)
    const res = await resumeSession(session.id)
    if (res?.success) setSession(res.session)
    setLoading(false)
  }

  async function startBreak(breakMode: 'short-break' | 'long-break') {
      // 1. End current session
      await handleStop() 
      // 2. Start break session
      const formData = new FormData()
      formData.append('taskName', breakMode === 'short-break' ? 'Short Break' : 'Long Break')
      formData.append('mode', breakMode)
      
      // Reset local mode so next time it defaults to something useful? 
      // Actually we just call handleStart logic manually
      setLoading(true)
      const result = await punchIn(formData)
      if (result?.success) setSession(result.session)
      setLoading(false)
  }

  // --- STATE 2: WORKING / PAUSED ---
  if (session && (session.status === 'active' || session.status === 'paused')) {
    const isPomo = session.mode === 'pomo'
    const isBreak = session.mode.includes('break')
    
    // Standard Timer View
    return (
      <div className={`relative flex flex-col items-center justify-center p-6 bg-zinc-900 border rounded-xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-300 ${session.status === 'paused' ? 'border-yellow-900/30' : isBreak ? 'border-blue-900/30' : 'border-red-900/30'}`}>
        
        {/* Settings Toggles */}
       <div className="absolute top-4 right-4 flex gap-2">
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-zinc-500 hover:text-zinc-300" 
                onClick={() => setSoundEnabled(!soundEnabled)}
                title={soundEnabled ? "Mute Sound" : "Enable Sound"}
            >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-zinc-500 hover:text-zinc-300"
                onClick={notifEnabled ? () => setNotifEnabled(false) : requestNotifPermission}
                title={notifEnabled ? "Disable Notifications" : "Enable Notifications"}
            >
                {notifEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            </Button>
       </div>

        <div className={`flex items-center gap-2 mb-4 font-mono text-sm tracking-widest uppercase animate-pulse ${session.status === 'paused' ? 'text-yellow-500' : isBreak ? 'text-blue-500' : 'text-red-500'}`}>
            <span className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${session.status === 'paused' ? 'bg-yellow-400' : isBreak ? 'bg-blue-400' : 'bg-red-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${session.status === 'paused' ? 'bg-yellow-500' : isBreak ? 'bg-blue-500' : 'bg-red-500'}`}></span>
            </span>
            {session.status === 'paused' ? 'Session Paused' : isBreak ? 'Break Time' : 'Session Active'}
            {isPomo && <span className="ml-2 text-zinc-500 font-bold border rounded px-1 border-zinc-700">Loop {(pomoCount % 4) + 1}/4</span>}
        </div>
        
        <div className="text-8xl font-black tabular-nums tracking-tighter text-zinc-100 mb-2 font-mono">
          {formattedTime}
        </div>
        
        <div className="text-zinc-500 text-lg mb-8 font-medium">
          {session.task_name}
        </div>

        <div className="flex items-center gap-4 w-full max-w-xs">
            {session.status === 'active' ? (
                 <Button 
                    onClick={handlePause} 
                    disabled={loading}
                    variant="outline" 
                    className="flex-1 h-14 text-lg font-bold border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-white"
                >
                    <Pause className="mr-2 h-5 w-5" />
                    PAUSE
                </Button>
            ) : (
                <Button 
                    onClick={handleResume} 
                    disabled={loading}
                    variant="outline" 
                    className="flex-1 h-14 text-lg font-bold border-yellow-500/50 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 hover:text-yellow-300"
                >
                    <Play className="mr-2 h-5 w-5" />
                    RESUME
                </Button>
            )}

            <Button 
                onClick={handleStop} 
                disabled={loading}
                variant="destructive" 
                className="h-14 w-14 p-0 rounded-lg shrink-0"
                title="End Session"
            >
                <StopCircle className="h-6 w-6" />
            </Button>
        </div>
      </div>
    )
  }

  // --- STATE 1: IDLE ---
  return (
    <div className="flex flex-col gap-6 p-6 bg-zinc-900/50 border border-zinc-800 rounded-xl">
       <div className="flex justify-between items-center">
            <h3 className="text-zinc-400 font-mono text-sm uppercase tracking-widest">New Session</h3>
            
            <div className="flex items-center gap-3">
                 <div className="flex items-center gap-1">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-zinc-500 hover:text-zinc-300" 
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        title={soundEnabled ? "Mute Sound" : "Enable Sound"}
                    >
                        {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-zinc-500 hover:text-zinc-300"
                        onClick={notifEnabled ? () => setNotifEnabled(false) : requestNotifPermission}
                        title={notifEnabled ? "Disable Notifications" : "Enable Notifications"}
                    >
                        {notifEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                    </Button>
                </div>
                
                <div className="h-4 w-px bg-zinc-800" />

                <ToggleGroup type="single" value={mode} onValueChange={(v) => v && setMode(v)}>
                    <ToggleGroupItem value="stopwatch" aria-label="Toggle stopwatch">
                        <Clock className="h-4 w-4 mr-2" />
                        Free
                    </ToggleGroupItem>
                    <ToggleGroupItem value="pomo" aria-label="Toggle pomodoro">
                        <Timer className="h-4 w-4 mr-2" />
                        Pomo
                    </ToggleGroupItem>
                    <ToggleGroupItem value="short-break" aria-label="Toggle break">
                        <Coffee className="h-4 w-4 mr-2" />
                        Break
                    </ToggleGroupItem>
                </ToggleGroup>
            </div>
       </div>

       <form action={handleStart} className="flex flex-col gap-4">
            <Input 
                name="taskName"
                placeholder={mode === 'short-break' ? "Taking a breather..." : "What are you working on?"}
                className="h-14 text-lg bg-zinc-950 border-zinc-800 focus:border-zinc-700"
                required
                autoComplete="off"
                defaultValue={mode === 'short-break' ? "Short Break" : ""}
            />
            
            <div className="text-zinc-500 text-sm px-1">
                {mode === 'stopwatch' && "Open-ended session. Count up timer for flexible deep work."}
                {mode === 'pomo' && "25-minute focused sprint. Alerts you when it's time for a break."}
                {mode === 'short-break' && "5-minute timer to recharge. Not counted towards study stats."}
                {mode === 'long-break' && "15-minute extended break. Go for a walk!"}
            </div>

            <Button 
                type="submit" 
                disabled={loading}
                className="h-14 text-lg font-bold bg-white text-black hover:bg-zinc-200"
            >
                {loading ? 'Initializing...' : (
                    <>
                        <Play className="mr-2 h-5 w-5" />
                        START SESSION
                    </>
                )}
            </Button>
       </form>
    </div>
  )
}
