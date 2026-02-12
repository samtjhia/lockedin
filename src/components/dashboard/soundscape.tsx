'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Volume2, VolumeX, CloudRain, Music, Pause, Play, Coffee } from 'lucide-react'

const SOUNDS = [
    { id: 'rain', name: 'Rain', icon: CloudRain, url: 'https://cdn.pixabay.com/audio/2022/07/04/audio_06d64d5059.mp3' }, // Free rain sound
    { id: 'lofi', name: 'Lofi', icon: Music, url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112762.mp3' }, // Free lofi beat
    { id: 'cafe', name: 'Cafe', icon: Coffee, url: 'https://cdn.pixabay.com/audio/2017/08/07/22/56/coffee-shop-2608889_1280.mp3' } // Cafe ambience
]

export function Soundscape() {
    const [activeSound, setActiveSound] = useState<string | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [volume, setVolume] = useState([0.5])
    const audioRef = useRef<HTMLAudioElement | null>(null)

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume[0]
        }
    }, [volume])

    useEffect(() => {
        if (activeSound) {
             const sound = SOUNDS.find(s => s.id === activeSound)
             if (sound && audioRef.current && audioRef.current.src !== sound.url) {
                 audioRef.current.src = sound.url
             }
        }
    }, [activeSound])

    useEffect(() => {
        if (isPlaying && activeSound) {
            audioRef.current?.play().catch(e => console.error(e))
        } else {
            audioRef.current?.pause()
        }
    }, [isPlaying, activeSound])

    const togglePlay = (id: string) => {
        if (activeSound === id) {
            setIsPlaying(!isPlaying)
        } else {
            setActiveSound(id)
            setIsPlaying(true)
        }
    }

    return (
        <Card className="border-zinc-800 bg-zinc-950/50">
            <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex gap-2">
                    {SOUNDS.map(sound => (
                        <Button
                            key={sound.id}
                            variant={activeSound === sound.id ? "secondary" : "ghost"}
                            size="icon"
                            onClick={() => togglePlay(sound.id)}
                            className={activeSound === sound.id && isPlaying ? "text-green-400 bg-green-400/10" : "text-zinc-500 hover:text-zinc-300"}
                            title={sound.name}
                        >
                            <sound.icon className="h-4 w-4" />
                        </Button>
                    ))}
                </div>

                <div className="flex items-center gap-2 flex-1 max-w-[120px]">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-zinc-500"
                        onClick={() => setVolume(v => v[0] === 0 ? [0.5] : [0])}
                    >
                        {volume[0] === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </Button>
                    <div className="relative w-full h-4 flex items-center">
                        <Slider
                            value={volume}
                            min={0}
                            max={1}
                            step={0.01}
                            onValueChange={setVolume}
                            className="w-full relative z-10"
                        />
                    </div>
                </div>
                
                <audio ref={audioRef} loop />
            </CardContent>
        </Card>
    )
}
