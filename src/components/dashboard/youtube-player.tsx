'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { useYouTubePlayer } from './youtube-player-context'

function getYouTubeVideoId(url: string): string | null {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /youtube\.com\/shorts\/([^&\n?#]+)/
    ]
    for (const pattern of patterns) {
        const match = url.match(pattern)
        if (match) return match[1]
    }
    return null
}

export function YouTubePlayer() {
    const { activeVideoId, activeVideoUrl, activeVideoTitle, stopVideo } = useYouTubePlayer()

    if (!activeVideoId || !activeVideoUrl) return null

    const videoId = getYouTubeVideoId(activeVideoUrl)
    if (!videoId) return null

    return (
        <Card className="border-border bg-muted/50">
            <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground truncate flex-1">{activeVideoTitle}</span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-muted-foreground hover:text-foreground/70"
                        onClick={stopVideo}
                    >
                        <X className="h-3 w-3" />
                    </Button>
                </div>
                <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-card">
                    <iframe
                        src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="absolute inset-0 w-full h-full"
                    />
                </div>
            </CardContent>
        </Card>
    )
}
