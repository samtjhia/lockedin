'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { ListTodo, Clock, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type DashboardGridProps = {
  taskList: React.ReactNode
  centerContent: React.ReactNode
  youtubePlayer?: React.ReactNode
  shiftLog: React.ReactNode
}

export function DashboardGrid({ taskList, centerContent, youtubePlayer, shiftLog }: DashboardGridProps) {
  const [mobilePanel, setMobilePanel] = useState<'none' | 'tasks' | 'log'>('none')

  // Close panel on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobilePanel('none')
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [])

  // Auto-open right panel on mobile when YouTube video starts
  useEffect(() => {
    const handleVideoStart = () => {
      // Only auto-open below xl breakpoint (1280px)
      if (window.innerWidth < 1280) {
        setMobilePanel('log')
      }
    }
    window.addEventListener('youtube-video-started', handleVideoStart)
    return () => window.removeEventListener('youtube-video-started', handleVideoStart)
  }, [])

  // Prevent body scroll when panel is open (mobile only)
  useEffect(() => {
    if (mobilePanel !== 'none') {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobilePanel])

  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 pb-20 xl:pb-8">
        {/* ── Left Column: Tasks ── */}
        {/* Mobile/Tablet: fixed slide-out panel from left */}
        {/* Desktop (xl+): normal grid cell with absolute fill trick */}
        <div className={cn(
          // Base / Mobile+Tablet: fixed off-screen panel
          "fixed inset-y-0 left-0 z-50 w-[320px] max-w-[85vw] bg-background border-r border-border transition-transform duration-300 ease-out",
          mobilePanel === 'tasks' ? 'translate-x-0' : '-translate-x-full',
          // Desktop override: static grid cell
          "xl:static xl:inset-auto xl:z-auto xl:w-auto xl:max-w-none xl:bg-transparent xl:border-r-0 xl:translate-x-0 xl:transition-none xl:col-span-1 xl:relative"
        )}>
          {/* Mobile close button */}
          <button
            onClick={() => setMobilePanel('none')}
            className="absolute top-3 right-3 z-10 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted xl:hidden"
            aria-label="Close tasks panel"
          >
            <X className="h-5 w-5" />
          </button>
          {/* Content wrapper: padded on mobile, absolute-fill on desktop */}
          <div className="h-full pt-12 px-3 pb-3 xl:pt-0 xl:px-0 xl:pb-0 xl:absolute xl:inset-0">
            {taskList}
          </div>
        </div>

        {/* ── Center Column: Focus & Charts ── */}
        <div className="col-span-1 xl:col-span-2 space-y-6 flex flex-col">
          {centerContent}
        </div>

        {/* ── Right Column: YouTube Player & Session Log ── */}
        {/* Mobile/Tablet: fixed slide-out panel from right */}
        {/* Desktop (xl+): normal grid cell with absolute fill trick */}
        <div className={cn(
          // Base / Mobile+Tablet: fixed off-screen panel
          "fixed inset-y-0 right-0 z-50 w-[320px] max-w-[85vw] bg-background border-l border-border transition-transform duration-300 ease-out",
          mobilePanel === 'log' ? 'translate-x-0' : 'translate-x-full',
          // Desktop override: static grid cell
          "xl:static xl:inset-auto xl:z-auto xl:w-auto xl:max-w-none xl:bg-transparent xl:border-l-0 xl:translate-x-0 xl:transition-none xl:col-span-1 xl:relative"
        )}>
          {/* Mobile close button */}
          <button
            onClick={() => setMobilePanel('none')}
            className="absolute top-3 left-3 z-10 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted xl:hidden"
            aria-label="Close session log panel"
          >
            <X className="h-5 w-5" />
          </button>
          {/* Content wrapper */}
          <div className="h-full pt-12 px-3 pb-3 xl:pt-0 xl:px-0 xl:pb-0 xl:absolute xl:inset-0 flex flex-col gap-4">
            {youtubePlayer ?? null}
            <div className="flex-1 relative min-h-0">
              <div className="xl:absolute xl:inset-0 h-full">
                {shiftLog}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile/Tablet: Backdrop overlay ── */}
      <div
        className={cn(
          "fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 xl:hidden",
          mobilePanel !== 'none' ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setMobilePanel('none')}
        aria-hidden="true"
      />

      {/* ── Mobile/Tablet: Floating toggle buttons ── */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 xl:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMobilePanel(p => p === 'tasks' ? 'none' : 'tasks')}
          className={cn(
            "border-border bg-background/90 backdrop-blur-md shadow-lg text-foreground/70 hover:text-foreground hover:bg-muted",
            mobilePanel === 'tasks' && "bg-muted border-zinc-500 text-foreground"
          )}
        >
          <ListTodo className="h-4 w-4 mr-1.5" />
          Tasks
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMobilePanel(p => p === 'log' ? 'none' : 'log')}
          className={cn(
            "border-border bg-background/90 backdrop-blur-md shadow-lg text-foreground/70 hover:text-foreground hover:bg-muted",
            mobilePanel === 'log' && "bg-muted border-zinc-500 text-foreground"
          )}
        >
          <Clock className="h-4 w-4 mr-1.5" />
          Session Log
        </Button>
      </div>
    </>
  )
}
