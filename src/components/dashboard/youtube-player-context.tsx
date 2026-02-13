'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

type YouTubePlayerContextType = {
    activeVideoId: string | null
    activeVideoUrl: string | null
    activeVideoTitle: string | null
    playerMode: 'embed' | 'external'
    setPlayerMode: (mode: 'embed' | 'external') => void
    playVideo: (id: string, url: string, title: string) => void
    stopVideo: () => void
}

const YouTubePlayerContext = createContext<YouTubePlayerContextType | null>(null)

export function YouTubePlayerProvider({ children }: { children: ReactNode }) {
    const [activeVideoId, setActiveVideoId] = useState<string | null>(null)
    const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null)
    const [activeVideoTitle, setActiveVideoTitle] = useState<string | null>(null)
    const [playerMode, setPlayerMode] = useState<'embed' | 'external'>('embed')

    const playVideo = (id: string, url: string, title: string) => {
        if (playerMode === 'external') {
            window.open(url, '_blank')
        } else {
            if (activeVideoId === id) {
                // Toggle off if same video
                setActiveVideoId(null)
                setActiveVideoUrl(null)
                setActiveVideoTitle(null)
            } else {
                setActiveVideoId(id)
                setActiveVideoUrl(url)
                setActiveVideoTitle(title)
            }
        }
    }

    const stopVideo = () => {
        setActiveVideoId(null)
        setActiveVideoUrl(null)
        setActiveVideoTitle(null)
    }

    return (
        <YouTubePlayerContext.Provider value={{
            activeVideoId,
            activeVideoUrl,
            activeVideoTitle,
            playerMode,
            setPlayerMode,
            playVideo,
            stopVideo
        }}>
            {children}
        </YouTubePlayerContext.Provider>
    )
}

export function useYouTubePlayer() {
    const context = useContext(YouTubePlayerContext)
    if (!context) {
        throw new Error('useYouTubePlayer must be used within YouTubePlayerProvider')
    }
    return context
}
