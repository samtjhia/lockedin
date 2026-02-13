'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Volume2, VolumeX, CloudRain, Flame, Moon, Waves, CloudLightning, Tv } from 'lucide-react'
import { getSounds } from '@/app/actions/dashboard'

const ICON_MAP: Record<string, any> = {
    rain: CloudRain,
    fire: Flame,
    night: Moon,
    ocean: Waves,
    storm: CloudLightning,
    white: Tv // Using TV icon to represent "Static/White Noise"
}

type Sound = {
    id: string
    label: string
    icon_key: string
    file_url: string
}

export function Soundscape() {
    const [sounds, setSounds] = useState<Sound[]>([])
    const [activeSound, setActiveSound] = useState<string | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [volume, setVolume] = useState([0.2])
    const audioRef = useRef<HTMLAudioElement | null>(null)

    useEffect(() => {
        getSounds().then(data => {
            if (data && data.length > 0) {
                setSounds(data)
            }
        })
    }, [])


    useEffect(() => {
        if (audioRef.current) {
            const sound = sounds.find(s => s.id === activeSound)
            // Apply volume reduction for ocean and white noise
            const volumeMultiplier = sound && (sound.icon_key === 'ocean' || sound.icon_key === 'white') ? 0.5 : 1
            audioRef.current.volume = volume[0] * volumeMultiplier
        }
    }, [volume, activeSound])

    useEffect(() => {
        if (activeSound) {
             const sound = sounds.find(s => s.id === activeSound)
             if (sound && audioRef.current && audioRef.current.src !== sound.file_url) {
                 audioRef.current.src = sound.file_url
             }
        }
    }, [activeSound, sounds])

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
            <CardContent className="p-2 flex items-center gap-3">
                <div className="flex gap-2">
                    {sounds.length === 0 ? (
                         <div className="text-zinc-600 text-xs">No sounds loaded</div>
                    ) : (
                        sounds.map(sound => {
                            const Icon = ICON_MAP[sound.icon_key] || Volume2
                            return (
                                <Button
                                    key={sound.id}
                                    variant={activeSound === sound.id ? "secondary" : "ghost"}
                                    size="icon"
                                    onClick={() => togglePlay(sound.id)}
                                    className={activeSound === sound.id && isPlaying ? "text-green-400 bg-green-400/10" : "text-zinc-500 hover:text-zinc-300"}
                                    title={sound.label}
                                >
                                    <Icon className="h-4 w-4" />
                                </Button>
                            )
                        })
                    )}
                </div>

                <div className="flex items-center gap-2 w-[120px]">
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
