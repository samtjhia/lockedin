'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export type Sound = {
  id: string
  label: string
  icon_key: string
  file_url: string
}

type AmbientSoundContextType = {
  sounds: Sound[]
  setSounds: (sounds: Sound[] | ((prev: Sound[]) => Sound[])) => void
  activeSound: string | null
  isPlaying: boolean
  volume: number[]
  setVolume: (v: number[] | ((prev: number[]) => number[])) => void
  togglePlay: (id: string) => void
}

const AmbientSoundContext = createContext<AmbientSoundContextType | null>(null)

export function AmbientSoundProvider({ children }: { children: ReactNode }) {
  const [sounds, setSounds] = useState<Sound[]>([])
  const [activeSound, setActiveSound] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState([0.2])
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const togglePlay = useCallback((id: string) => {
    if (activeSound === id) {
      setIsPlaying(p => !p)
    } else {
      setActiveSound(id)
      setIsPlaying(true)
    }
  }, [activeSound])

  // Sync volume to audio element
  useEffect(() => {
    if (!audioRef.current) return
    const sound = sounds.find(s => s.id === activeSound)
    const multiplier = sound && (sound.icon_key === 'ocean' || sound.icon_key === 'white') ? 0.5 : 1
    audioRef.current.volume = volume[0] * multiplier
  }, [volume, activeSound, sounds])

  // Sync src when activeSound changes
  useEffect(() => {
    if (!activeSound) return
    const sound = sounds.find(s => s.id === activeSound)
    if (sound && audioRef.current && audioRef.current.src !== sound.file_url) {
      audioRef.current.src = sound.file_url
    }
  }, [activeSound, sounds])

  // Play/pause
  useEffect(() => {
    if (isPlaying && activeSound) {
      audioRef.current?.play().catch(e => console.error(e))
    } else {
      audioRef.current?.pause()
    }
  }, [isPlaying, activeSound])

  return (
    <AmbientSoundContext.Provider
      value={{
        sounds,
        setSounds,
        activeSound,
        isPlaying,
        volume,
        setVolume,
        togglePlay,
      }}
    >
      {children}
      {/* Persistent audio element so sound continues when navigating away from dashboard */}
      <audio ref={audioRef} loop playsInline />
    </AmbientSoundContext.Provider>
  )
}

export function useAmbientSound() {
  const ctx = useContext(AmbientSoundContext)
  if (!ctx) throw new Error('useAmbientSound must be used within AmbientSoundProvider')
  return ctx
}
