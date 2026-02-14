'use client'

import { useState, useEffect } from 'react'
import { useFactoryTimer, type PomoConfig } from '../../hooks/use-factory-timer'
import { punchIn, punchOut, pauseSession, resumeSession, transitionSession, getPomoStats, updatePomoSettings } from '@/app/(factory)/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { StopCircle, Play, Timer, Clock, Pause, Coffee, Bell, BellOff, Volume2, VolumeX, Maximize2, Minimize2, Settings2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

const POMO_STORAGE_KEY = 'lockedin-pomo-settings'
const DEFAULT_POMO: PomoConfig = { sessionMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15 }

function getStoredPomoConfig(): PomoConfig {
  if (typeof window === 'undefined') return DEFAULT_POMO
  try {
    const raw = localStorage.getItem(POMO_STORAGE_KEY)
    if (!raw) return DEFAULT_POMO
    const parsed = JSON.parse(raw) as Partial<PomoConfig>
    return {
      sessionMinutes: clamp(parsed.sessionMinutes ?? 25, 1, 120),
      shortBreakMinutes: clamp(parsed.shortBreakMinutes ?? 5, 1, 60),
      longBreakMinutes: clamp(parsed.longBreakMinutes ?? 15, 1, 60),
    }
  } catch {
    return DEFAULT_POMO
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

type FocusControllerProps = {
  initialSession: any 
}

export function FocusController({ initialSession }: FocusControllerProps) {
  const router = useRouter()
  // Local state to track session immediately before server revalidate
  const [session, setSession] = useState(initialSession)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<string>('stopwatch')
  const [pomoCount, setPomoCount] = useState(0)
  const [cycleSize, setCycleSize] = useState(4)
  const [pomoConfig, setPomoConfig] = useState<PomoConfig>(DEFAULT_POMO)
  const [pomoSettingsOpen, setPomoSettingsOpen] = useState(false)
  const [taskName, setTaskName] = useState('')

  useEffect(() => {
     const handlePlayTask = (e: CustomEvent) => {
        if (e.detail) {
            setTaskName(e.detail)
            // If in break mode, switch to focus mode
            if (mode === 'short-break' || mode === 'long-break') {
                setMode('stopwatch')
            }
        }
     }
     window.addEventListener('play-task', handlePlayTask as EventListener)
     return () => window.removeEventListener('play-task', handlePlayTask as EventListener)
  }, [mode])

  // Update task name when mode changes to break
  useEffect(() => {
    if (mode === 'short-break') setTaskName('Short Break')
    else if (mode === 'long-break') setTaskName('Long Break')
    // Don't clear it automatically when switching back to work, let user decide or keep previous
  }, [mode])


  // Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    if (!isFullscreen) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleEsc)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleEsc)
    }
  }, [isFullscreen])

  // Close fullscreen when session ends
  useEffect(() => {
    if (!session) setIsFullscreen(false)
  }, [session])

  // Warn when closing/navigating away with an active or paused session (can't run code after tab closes)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (session && (session.status === 'active' || session.status === 'paused')) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [session?.id, session?.status])

  // Settings
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [notifEnabled, setNotifEnabled] = useState(false)
  
  // Init stats, cycle size, and pomo config (from localStorage)
  useEffect(() => {
     getPomoStats().then(s => {
       setPomoCount(s.count)
       setCycleSize(s.cycleSize ?? 4)
     })
     setPomoConfig(getStoredPomoConfig())
     if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        setNotifEnabled(true)
     }
  }, [])

  // Function to request notification permission
  const requestNotifPermission = async () => {
    if (!('Notification' in window)) return
    const permission = await Notification.requestPermission()
    setNotifEnabled(permission === 'granted')
  }

  // Timer hook (pomoConfig drives session/short/long break durations)
  const { formattedTime, isRunning, isFinished } = useFactoryTimer(
      session?.status,
      session?.last_resumed_at,
      session?.accumulated_seconds,
      session?.mode || 'stopwatch',
      pomoConfig
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

         // Desktop Notification (not available on Safari iOS / some mobile browsers)
         if (notifEnabled && document.hidden && typeof window !== 'undefined' && 'Notification' in window) {
            try {
              new Notification('Session Complete', { body: 'Time to switch context!' })
            } catch (_) {}
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
    setError(null)
    formData.append('mode', mode)
    
    try {
      const result = await punchIn(formData)
      if (result?.success && result.session) {
        setSession(result.session)
      } else if (result?.error) {
         setError(result.error)
      }
    } catch (e) {
      console.error(e)
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  async function handleStop() {
    if (!session?.id) return
    setLoading(true)
    const res = await punchOut(session.id)
    if (res?.success) {
        setSession(null)
        // Refresh the page data so log and charts update
        router.refresh()
        // Adding a small timeout reload for good measure if server components are cached aggressively
        setTimeout(() => {
             window.dispatchEvent(new Event('session-completed'))
        }, 500)
    }
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
      <>
        <div className={`relative flex flex-col items-center justify-center p-4 pt-12 sm:p-6 sm:pt-14 bg-card border rounded-xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-300 ${session.status === 'paused' ? 'border-yellow-900/30' : isBreak ? 'border-blue-900/30' : 'border-red-900/30'}`}>
          {/* Settings Toggles */}
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex gap-1 sm:gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground/70" onClick={() => setIsFullscreen(true)} title="Fullscreen">
              <Maximize2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground/70" onClick={() => setSoundEnabled(!soundEnabled)} title={soundEnabled ? "Mute Sound" : "Enable Sound"}>
              {soundEnabled ? <Volume2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <VolumeX className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground/70" onClick={notifEnabled ? () => setNotifEnabled(false) : requestNotifPermission} title={notifEnabled ? "Disable Notifications" : "Enable Notifications"}>
              {notifEnabled ? <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <BellOff className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            </Button>
          </div>

          <div className={`flex items-center gap-2 mb-3 sm:mb-4 font-mono text-xs sm:text-sm tracking-widest uppercase animate-pulse ${session.status === 'paused' ? 'text-yellow-500' : isBreak ? 'text-blue-500' : 'text-red-500'}`}>
            <span className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${session.status === 'paused' ? 'bg-yellow-400' : isBreak ? 'bg-blue-400' : 'bg-red-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${session.status === 'paused' ? 'bg-yellow-500' : isBreak ? 'bg-blue-500' : 'bg-red-500'}`}></span>
            </span>
            {session.status === 'paused' ? 'Session Paused' : isBreak ? 'Break Time' : 'Session Active'}
            {isPomo && <span className="ml-2 text-muted-foreground font-bold border rounded px-1 border-border text-[10px] sm:text-xs">Loop {(pomoCount % cycleSize) + 1}/{cycleSize}</span>}
          </div>

          <div className="text-5xl sm:text-7xl md:text-8xl font-black tabular-nums tracking-tighter text-foreground mb-1 sm:mb-2 font-mono">
            {formattedTime}
          </div>

          <div className="text-muted-foreground text-sm sm:text-lg mb-6 sm:mb-8 font-medium truncate max-w-full px-4 text-center">
            {session.task_name}
          </div>

          <div className="flex items-center gap-3 sm:gap-4 w-full max-w-xs">
            {session.status === 'active' ? (
              <Button onClick={handlePause} disabled={loading} variant="outline" className="flex-1 h-12 sm:h-14 text-base sm:text-lg font-bold border-border bg-card text-foreground hover:bg-muted hover:text-foreground">
                <Pause className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> PAUSE
              </Button>
            ) : (
              <Button onClick={handleResume} disabled={loading} variant="outline" className="flex-1 h-12 sm:h-14 text-base sm:text-lg font-bold border-yellow-500/50 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 hover:text-yellow-300">
                <Play className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> RESUME
              </Button>
            )}
            <Button onClick={handleStop} disabled={loading} variant="destructive" className="h-12 w-12 sm:h-14 sm:w-14 p-0 rounded-lg shrink-0" title="End Session">
              <StopCircle className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>
          </div>
        </div>

        {/* Fullscreen overlay */}
        <div
          className={`fixed inset-0 z-[100] bg-background transition-opacity duration-300 ease-out ${isFullscreen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
          style={{ height: '100dvh' }}
        >
          {/* Top bar with controls */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-end p-4 sm:p-6 z-10">
            <div className="flex gap-1.5 sm:gap-2">
              <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10 text-muted-foreground hover:text-foreground/70" onClick={() => setSoundEnabled(!soundEnabled)} title={soundEnabled ? "Mute Sound" : "Enable Sound"}>
                {soundEnabled ? <Volume2 className="h-4 w-4 sm:h-5 sm:w-5" /> : <VolumeX className="h-4 w-4 sm:h-5 sm:w-5" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10 text-muted-foreground hover:text-foreground/70" onClick={notifEnabled ? () => setNotifEnabled(false) : requestNotifPermission} title={notifEnabled ? "Disable Notifications" : "Enable Notifications"}>
                {notifEnabled ? <Bell className="h-4 w-4 sm:h-5 sm:w-5" /> : <BellOff className="h-4 w-4 sm:h-5 sm:w-5" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10 text-muted-foreground hover:text-foreground/70" onClick={() => setIsFullscreen(false)} title="Exit fullscreen">
                <Minimize2 className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </div>
          </div>

          {/* Centered timer content */}
          <div className="flex flex-col items-center justify-center h-full px-6 pt-14 pb-12">
            <div className={`flex items-center gap-2 mb-4 sm:mb-6 font-mono text-xs sm:text-sm tracking-widest uppercase animate-pulse ${session.status === 'paused' ? 'text-yellow-500' : isBreak ? 'text-blue-500' : 'text-red-500'}`}>
              <span className="relative flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${session.status === 'paused' ? 'bg-yellow-400' : isBreak ? 'bg-blue-400' : 'bg-red-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${session.status === 'paused' ? 'bg-yellow-500' : isBreak ? 'bg-blue-500' : 'bg-red-500'}`}></span>
              </span>
              {session.status === 'paused' ? 'Session Paused' : isBreak ? 'Break Time' : 'Session Active'}
              {isPomo && <span className="ml-2 text-muted-foreground font-bold border rounded px-1 border-border text-[10px] sm:text-xs">Loop {(pomoCount % cycleSize) + 1}/{cycleSize}</span>}
            </div>

            <div className="text-6xl sm:text-8xl md:text-9xl lg:text-[10rem] font-black tabular-nums tracking-tighter text-foreground mb-2 sm:mb-4 font-mono">
              {formattedTime}
            </div>

            <div className="text-muted-foreground text-base sm:text-xl md:text-2xl mb-8 sm:mb-12 font-medium truncate max-w-full text-center">
              {session.task_name}
            </div>

            <div className="flex items-center gap-3 sm:gap-4 w-full max-w-xs sm:max-w-sm">
              {session.status === 'active' ? (
                <Button onClick={handlePause} disabled={loading} variant="outline" className="flex-1 h-12 sm:h-14 text-base sm:text-lg font-bold border-border bg-card text-foreground hover:bg-muted hover:text-foreground">
                  <Pause className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> PAUSE
                </Button>
              ) : (
                <Button onClick={handleResume} disabled={loading} variant="outline" className="flex-1 h-12 sm:h-14 text-base sm:text-lg font-bold border-yellow-500/50 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 hover:text-yellow-300">
                  <Play className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> RESUME
                </Button>
              )}
              <Button onClick={handleStop} disabled={loading} variant="destructive" className="h-12 w-12 sm:h-14 sm:w-14 p-0 rounded-lg shrink-0" title="End Session">
                <StopCircle className="h-5 w-5 sm:h-6 sm:w-6" />
              </Button>
            </div>
          </div>

          {/* Bottom hint */}
          <div className="absolute bottom-0 left-0 right-0 pb-[env(safe-area-inset-bottom,12px)] p-4 text-center">
            <p className="text-[11px] text-muted-foreground">
              Press <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-[10px] font-mono">Esc</kbd> or tap <Minimize2 className="inline h-3 w-3" /> to exit
            </p>
          </div>
        </div>
      </>
    )
  }

  // --- STATE 1: IDLE ---
  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6 bg-card/50 border border-border rounded-xl">
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
            <h3 className="text-muted-foreground font-mono text-xs sm:text-sm uppercase tracking-widest">New Session</h3>
            
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                 <div className="flex items-center gap-1">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground/70" 
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        title={soundEnabled ? "Mute Sound" : "Enable Sound"}
                    >
                        {soundEnabled ? <Volume2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <VolumeX className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground/70"
                        onClick={notifEnabled ? () => setNotifEnabled(false) : requestNotifPermission}
                        title={notifEnabled ? "Disable Notifications" : "Enable Notifications"}
                    >
                        {notifEnabled ? <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <BellOff className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                    </Button>
                </div>
                
                <div className="h-4 w-px bg-muted" />

                <ToggleGroup type="single" value={mode} onValueChange={(v) => v && setMode(v)}>
                    <ToggleGroupItem value="stopwatch" aria-label="Toggle stopwatch" className="text-xs sm:text-sm px-2 sm:px-3">
                        <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        Free
                    </ToggleGroupItem>
                    <ToggleGroupItem value="pomo" aria-label="Toggle pomodoro" className="text-xs sm:text-sm px-2 sm:px-3">
                        <Timer className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        Pomo
                    </ToggleGroupItem>
                    <ToggleGroupItem value="short-break" aria-label="Toggle break" className="text-xs sm:text-sm px-2 sm:px-3">
                        <Coffee className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        Break
                    </ToggleGroupItem>
                </ToggleGroup>
                {mode === 'pomo' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground/70 shrink-0"
                    onClick={() => setPomoSettingsOpen(true)}
                    title="Pomodoro settings"
                    aria-label="Pomodoro settings"
                  >
                    <Settings2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                )}
            </div>
       </div>

       <form action={handleStart} className="flex flex-col gap-3 sm:gap-4">
            <Input 
                name="taskName"
                placeholder={mode === 'short-break' ? "Taking a breather..." : "What are you working on?"}
                className={`h-12 sm:h-14 text-base sm:text-lg bg-background focus:border-border ${error ? 'border-red-500/50 focus-visible:ring-red-500/20' : 'border-border'}`}
                required
                autoComplete="off"
                value={taskName}
                onChange={(e) => {
                    setTaskName(e.target.value)
                    if (error) setError(null)
                }}
            />
            
            {error && (
                <div className="text-red-400 text-xs sm:text-sm font-bold flex items-center gap-2 animate-in slide-in-from-left-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                    {error}
                </div>
            )}
            
            <div className="text-muted-foreground text-xs sm:text-sm px-1">
                {mode === 'stopwatch' && "Open-ended session. Count up timer for flexible deep work."}
                {mode === 'pomo' && `${pomoConfig.sessionMinutes}-minute focused sprint. Alerts you when it's time for a break.`}
                {mode === 'short-break' && `${pomoConfig.shortBreakMinutes}-minute timer to recharge. Not counted towards study stats.`}
                {mode === 'long-break' && `${pomoConfig.longBreakMinutes}-minute extended break. Go for a walk!`}
            </div>

            <Button 
                type="submit" 
                disabled={loading}
                className="h-12 sm:h-14 text-base sm:text-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90"
            >
                {loading ? 'Initializing...' : (
                    <>
                        <Play className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                        START SESSION
                    </>
                )}
            </Button>
       </form>

       {/* Pomodoro settings dialog */}
       <PomoSettingsDialog
         open={pomoSettingsOpen}
         onOpenChange={setPomoSettingsOpen}
         initialConfig={pomoConfig}
         initialCycleSize={cycleSize}
         onSave={(config, size) => {
           setPomoConfig(config)
           setCycleSize(size)
           try {
             localStorage.setItem(POMO_STORAGE_KEY, JSON.stringify(config))
           } catch (_) {}
         }}
       />
    </div>
  )
}

type PomoSettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialConfig: PomoConfig
  initialCycleSize: number
  onSave: (config: PomoConfig, cycleSize: number) => void
}

function PomoSettingsDialog({ open, onOpenChange, initialConfig, initialCycleSize, onSave }: PomoSettingsDialogProps) {
  const [sessionMinutes, setSessionMinutes] = useState(String(initialConfig.sessionMinutes))
  const [shortBreakMinutes, setShortBreakMinutes] = useState(String(initialConfig.shortBreakMinutes))
  const [longBreakMinutes, setLongBreakMinutes] = useState(String(initialConfig.longBreakMinutes))
  const [cycleSize, setCycleSize] = useState(String(initialCycleSize))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Sync form when dialog opens with current values
  useEffect(() => {
    if (open) {
      setSessionMinutes(String(initialConfig.sessionMinutes))
      setShortBreakMinutes(String(initialConfig.shortBreakMinutes))
      setLongBreakMinutes(String(initialConfig.longBreakMinutes))
      setCycleSize(String(initialCycleSize))
      setSaveError(null)
    }
  }, [open, initialConfig.sessionMinutes, initialConfig.shortBreakMinutes, initialConfig.longBreakMinutes, initialCycleSize])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaveError(null)
    const s = clamp(parseInt(sessionMinutes, 10) || 25, 1, 120)
    const sh = clamp(parseInt(shortBreakMinutes, 10) || 5, 1, 60)
    const l = clamp(parseInt(longBreakMinutes, 10) || 15, 1, 60)
    const c = clamp(parseInt(cycleSize, 10) || 4, 2, 20)
    setSaving(true)
    const res = await updatePomoSettings(c)
    setSaving(false)
    if (res?.error) {
      setSaveError(res.error)
      return
    }
    onSave({ sessionMinutes: s, shortBreakMinutes: sh, longBreakMinutes: l }, c)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(90vw,22rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Pomodoro settings</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Set session and break lengths. Breaks are never counted as study time.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="grid gap-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pomo-session" className="text-xs sm:text-sm">Focus session (min)</Label>
              <Input
                id="pomo-session"
                type="number"
                min={1}
                max={120}
                value={sessionMinutes}
                onChange={(e) => setSessionMinutes(e.target.value)}
                className="h-10 sm:h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pomo-short" className="text-xs sm:text-sm">Short break (min)</Label>
              <Input
                id="pomo-short"
                type="number"
                min={1}
                max={60}
                value={shortBreakMinutes}
                onChange={(e) => setShortBreakMinutes(e.target.value)}
                className="h-10 sm:h-11"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pomo-long" className="text-xs sm:text-sm">Long break (min)</Label>
              <Input
                id="pomo-long"
                type="number"
                min={1}
                max={60}
                value={longBreakMinutes}
                onChange={(e) => setLongBreakMinutes(e.target.value)}
                className="h-10 sm:h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pomo-cycles" className="text-xs sm:text-sm">Sessions before long break</Label>
              <Input
                id="pomo-cycles"
                type="number"
                min={2}
                max={20}
                value={cycleSize}
                onChange={(e) => setCycleSize(e.target.value)}
                className="h-10 sm:h-11"
              />
            </div>
          </div>
          {saveError && (
            <p className="text-red-500 text-xs sm:text-sm">{saveError}</p>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="sm:order-1">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="sm:order-2">
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
