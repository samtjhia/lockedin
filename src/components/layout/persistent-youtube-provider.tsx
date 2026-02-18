'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GripVertical } from 'lucide-react'
import { YouTubePlayerProvider, useYouTubePlayer } from '@/components/dashboard/youtube-player-context'
import { YouTubePlayer } from '@/components/dashboard/youtube-player'

const MIN_W = 260
const MIN_H = 180
const DEFAULT_W = 320
const DEFAULT_H = 220
const MAX_W_VW = 98
const MAX_H_VH = 92

/**
 * Only mounts the floating player when a video is active so we don't show an empty box.
 * Resizable from the top-left corner; max size 98vw × 92vh.
 */
function PersistentYouTubePopout() {
  const { activeVideoId } = useYouTubePlayer()
  const [size, setSize] = useState({ w: DEFAULT_W, h: DEFAULT_H })
  const [resizing, setResizing] = useState(false)
  const startRef = useRef({ x: 0, y: 0, w: 0, h: 0 })

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      startRef.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h }
      setResizing(true)
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    },
    [size.w, size.h]
  )

  useEffect(() => {
    if (!resizing) return
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - startRef.current.x
      const dy = e.clientY - startRef.current.y
      const maxW = (window.innerWidth * MAX_W_VW) / 100
      const maxH = (window.innerHeight * MAX_H_VH) / 100
      const newW = Math.min(maxW, Math.max(MIN_W, startRef.current.w - dx))
      const newH = Math.min(maxH, Math.max(MIN_H, startRef.current.h - dy))
      setSize({ w: newW, h: newH })
    }
    const onUp = () => setResizing(false)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [resizing])

  if (!activeVideoId) return null

  return (
    <div
      className="fixed right-4 z-40 pointer-events-auto overflow-hidden flex flex-col rounded-lg border border-border bg-muted/50 shadow-lg bottom-24 xl:bottom-4"
      style={{
        width: size.w,
        height: size.h,
        minWidth: MIN_W,
        minHeight: MIN_H,
        maxWidth: '98vw',
        maxHeight: '92vh',
      }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label="Resize video"
        onPointerDown={handlePointerDown}
        className="absolute top-0 left-0 z-10 flex items-center gap-1 px-2 py-1.5 rounded-br-md bg-muted/80 hover:bg-muted touch-none select-none"
        style={{ cursor: 'nwse-resize' }}
      >
        <GripVertical className="h-3.5 w-3 text-muted-foreground rotate-90" />
      </div>
      <YouTubePlayer floating />
    </div>
  )
}

/**
 * Wraps the app with YouTube player context and a persistent floating player
 * so inline video keeps playing when navigating (e.g. dashboard → leaderboard).
 * On mobile, positioned above the dashboard Tasks/Session Log buttons (bottom-24).
 * Player is resizable via the corner handle.
 */
export function PersistentYouTubeProvider({ children }: { children: React.ReactNode }) {
  return (
    <YouTubePlayerProvider>
      {children}
      <PersistentYouTubePopout />
    </YouTubePlayerProvider>
  )
}
