'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { 
    Volume2, VolumeX, CloudRain, Flame, Moon, Waves, CloudLightning, Tv, 
    Youtube, Plus, X, ExternalLink, Play, Pencil, Link2 
} from 'lucide-react'
import { getSounds, getUserLinks, addUserLink, deleteUserLink, updateUserLink, UserLink } from '@/app/actions/dashboard'
import { useYouTubePlayer } from './youtube-player-context'

const ICON_MAP: Record<string, any> = {
    rain: CloudRain,
    fire: Flame,
    night: Moon,
    ocean: Waves,
    storm: CloudLightning,
    white: Tv
}

type Sound = {
    id: string
    label: string
    icon_key: string
    file_url: string
}

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

function getFavicon(url: string): string | null {
    try {
        const domain = new URL(url).hostname
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
    } catch {
        return null
    }
}

export function DashboardToolbar() {
    // YouTube context
    const { activeVideoId, playerMode, setPlayerMode, playVideo } = useYouTubePlayer()

    // Sound state
    const [sounds, setSounds] = useState<Sound[]>([])
    const [activeSound, setActiveSound] = useState<string | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [volume, setVolume] = useState([0.2])
    const audioRef = useRef<HTMLAudioElement | null>(null)

    // Quick links state
    const [quickLinks, setQuickLinks] = useState<UserLink[]>([])
    const [isAddingQL, setIsAddingQL] = useState(false)
    const [editingQLId, setEditingQLId] = useState<string | null>(null)
    const [qlTitle, setQlTitle] = useState('')
    const [qlUrl, setQlUrl] = useState('')

    // YouTube links state
    const [youtubeLinks, setYoutubeLinks] = useState<UserLink[]>([])
    const [isAddingYT, setIsAddingYT] = useState(false)
    const [editingYTId, setEditingYTId] = useState<string | null>(null)
    const [ytTitle, setYtTitle] = useState('')
    const [ytUrl, setYtUrl] = useState('')

    useEffect(() => {
        getSounds().then(data => {
            if (data && data.length > 0) setSounds(data)
        })
        getUserLinks('quick').then(data => setQuickLinks(data))
        getUserLinks('youtube').then(data => setYoutubeLinks(data))
    }, [])

    // Sound effects
    useEffect(() => {
        if (audioRef.current) {
            const sound = sounds.find(s => s.id === activeSound)
            const volumeMultiplier = sound && (sound.icon_key === 'ocean' || sound.icon_key === 'white') ? 0.5 : 1
            audioRef.current.volume = volume[0] * volumeMultiplier
        }
    }, [volume, activeSound, sounds])

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

    // Quick Links handlers
    const handleAddQL = async () => {
        if (!qlTitle.trim() || !qlUrl.trim()) return
        let finalUrl = qlUrl.trim()
        if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
            finalUrl = 'https://' + finalUrl
        }
        const result = await addUserLink(qlTitle.trim(), finalUrl, 'quick')
        if (result.success) {
            const newLinks = await getUserLinks('quick')
            setQuickLinks(newLinks)
            setQlTitle('')
            setQlUrl('')
            setIsAddingQL(false)
        }
    }

    const handleUpdateQL = async () => {
        if (!editingQLId || !qlTitle.trim() || !qlUrl.trim()) return
        let finalUrl = qlUrl.trim()
        if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
            finalUrl = 'https://' + finalUrl
        }
        const result = await updateUserLink(editingQLId, qlTitle.trim(), finalUrl)
        if (result.success) {
            const newLinks = await getUserLinks('quick')
            setQuickLinks(newLinks)
            setQlTitle('')
            setQlUrl('')
            setEditingQLId(null)
        }
    }

    const handleDeleteQL = async (id: string) => {
        const result = await deleteUserLink(id)
        if (result.success) {
            setQuickLinks(quickLinks.filter(l => l.id !== id))
        }
    }

    const startEditQL = (link: UserLink) => {
        setEditingQLId(link.id)
        setQlTitle(link.title)
        setQlUrl(link.url)
        setIsAddingQL(false)
    }

    // YouTube handlers
    const handleAddYT = async () => {
        if (!ytTitle.trim() || !ytUrl.trim()) return
        const videoId = getYouTubeVideoId(ytUrl.trim())
        if (!videoId) return
        const result = await addUserLink(ytTitle.trim(), ytUrl.trim(), 'youtube')
        if (result.success) {
            const newLinks = await getUserLinks('youtube')
            setYoutubeLinks(newLinks)
            setYtTitle('')
            setYtUrl('')
            setIsAddingYT(false)
        }
    }

    const handleUpdateYT = async () => {
        if (!editingYTId || !ytTitle.trim() || !ytUrl.trim()) return
        const result = await updateUserLink(editingYTId, ytTitle.trim(), ytUrl.trim())
        if (result.success) {
            const newLinks = await getUserLinks('youtube')
            setYoutubeLinks(newLinks)
            setYtTitle('')
            setYtUrl('')
            setEditingYTId(null)
        }
    }

    const handleDeleteYT = async (id: string) => {
        const result = await deleteUserLink(id)
        if (result.success) {
            setYoutubeLinks(youtubeLinks.filter(l => l.id !== id))
        }
    }

    const handlePlayYT = (link: UserLink) => {
        playVideo(link.id, link.url, link.title)
    }

    const startEditYT = (link: UserLink) => {
        setEditingYTId(link.id)
        setYtTitle(link.title)
        setYtUrl(link.url)
        setIsAddingYT(false)
    }

    return (
        <>
            <Card className="border-zinc-800 bg-zinc-950/50">
                <CardContent className="p-2 flex items-center gap-2 flex-wrap">
                    {/* Quick Links Section */}
                    <div className="flex items-center gap-1">
                        <Link2 className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                        {quickLinks.map(link => (
                            <div key={link.id} className="group relative">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-zinc-400 hover:text-zinc-200 gap-1"
                                    onClick={() => window.open(link.url, '_blank')}
                                    title={link.url}
                                >
                                    {getFavicon(link.url) && (
                                        <img 
                                            src={getFavicon(link.url)!} 
                                            alt="" 
                                            className="h-3 w-3"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none'
                                            }}
                                        />
                                    )}
                                    {link.title}
                                </Button>
                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full hidden group-hover:flex items-center gap-0.5 bg-zinc-800 rounded px-1 py-0.5 shadow-lg z-20 pb-2">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); startEditQL(link) }}
                                        className="h-5 w-5 rounded flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
                                    >
                                        <Pencil className="h-3 w-3" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteQL(link.id) }}
                                        className="h-5 w-5 rounded flex items-center justify-center text-zinc-400 hover:text-red-400 hover:bg-zinc-700"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {(isAddingQL || editingQLId) && (
                            <div className="flex items-center gap-1">
                                <Input placeholder="Title" value={qlTitle} onChange={(e) => setQlTitle(e.target.value)} className="h-7 w-16 text-xs text-zinc-100 placeholder:text-zinc-500 bg-zinc-800 border-zinc-600 focus:border-zinc-500" />
                                <Input placeholder="URL" value={qlUrl} onChange={(e) => setQlUrl(e.target.value)} className="h-7 w-24 text-xs text-zinc-100 placeholder:text-zinc-500 bg-zinc-800 border-zinc-600 focus:border-zinc-500" onKeyDown={(e) => { if (e.key === 'Enter') editingQLId ? handleUpdateQL() : handleAddQL() }} />
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-300 hover:text-zinc-100" onClick={editingQLId ? handleUpdateQL : handleAddQL}><Plus className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-zinc-300" onClick={() => { setIsAddingQL(false); setEditingQLId(null); setQlTitle(''); setQlUrl('') }}><X className="h-4 w-4" /></Button>
                            </div>
                        )}
                        {!isAddingQL && !editingQLId && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-zinc-300" onClick={() => setIsAddingQL(true)} title="Add quick link">
                                <Plus className="h-3 w-3" />
                            </Button>
                        )}
                    </div>

                    <div className="h-5 w-px bg-zinc-700" />

                    {/* YouTube Section */}
                    <div className="flex items-center gap-1">
                        <Youtube className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-zinc-500 hover:text-zinc-300 px-1"
                            onClick={() => setPlayerMode(playerMode === 'embed' ? 'external' : 'embed')}
                            title={playerMode === 'embed' ? 'Inline player' : 'Opens in new tab'}
                        >
                            {playerMode === 'embed' ? <Play className="h-3 w-3" /> : <ExternalLink className="h-3 w-3" />}
                        </Button>
                        {youtubeLinks.map(link => (
                            <div key={link.id} className="group relative">
                                <Button
                                    variant={activeVideoId === link.id ? "secondary" : "ghost"}
                                    size="sm"
                                    className={`h-7 px-2 text-xs ${activeVideoId === link.id ? 'text-zinc-100 bg-zinc-700' : 'text-zinc-400 hover:text-zinc-200'}`}
                                    onClick={() => handlePlayYT(link)}
                                    title={link.url}
                                >
                                    {link.title}
                                </Button>
                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full hidden group-hover:flex items-center gap-0.5 bg-zinc-800 rounded px-1 py-0.5 shadow-lg z-20 pb-2">
                                    <button onClick={(e) => { e.stopPropagation(); startEditYT(link) }} className="h-5 w-5 rounded flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700">
                                        <Pencil className="h-3 w-3" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteYT(link.id) }} className="h-5 w-5 rounded flex items-center justify-center text-zinc-400 hover:text-red-400 hover:bg-zinc-700">
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {(isAddingYT || editingYTId) && (
                            <div className="flex items-center gap-1">
                                <Input placeholder="Title" value={ytTitle} onChange={(e) => setYtTitle(e.target.value)} className="h-7 w-16 text-xs text-zinc-100 placeholder:text-zinc-500 bg-zinc-800 border-zinc-600 focus:border-zinc-500" />
                                <Input placeholder="YT URL" value={ytUrl} onChange={(e) => setYtUrl(e.target.value)} className="h-7 w-28 text-xs text-zinc-100 placeholder:text-zinc-500 bg-zinc-800 border-zinc-600 focus:border-zinc-500" onKeyDown={(e) => { if (e.key === 'Enter') editingYTId ? handleUpdateYT() : handleAddYT() }} />
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-300 hover:text-zinc-100" onClick={editingYTId ? handleUpdateYT : handleAddYT}><Plus className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-zinc-300" onClick={() => { setIsAddingYT(false); setEditingYTId(null); setYtTitle(''); setYtUrl('') }}><X className="h-4 w-4" /></Button>
                            </div>
                        )}
                        {!isAddingYT && !editingYTId && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-zinc-300" onClick={() => setIsAddingYT(true)} title="Add YouTube link">
                                <Plus className="h-3 w-3" />
                            </Button>
                        )}
                    </div>

                    <div className="h-5 w-px bg-zinc-700" />

                    {/* Sound Section */}
                    <div className="flex items-center gap-1">
                        {sounds.length === 0 ? (
                            <div className="text-zinc-600 text-xs">No sounds</div>
                        ) : (
                            sounds.map(sound => {
                                const Icon = ICON_MAP[sound.icon_key] || Volume2
                                return (
                                    <Button
                                        key={sound.id}
                                        variant={activeSound === sound.id ? "secondary" : "ghost"}
                                        size="icon"
                                        onClick={() => togglePlay(sound.id)}
                                        className={`h-7 w-7 ${activeSound === sound.id && isPlaying ? "text-green-400 bg-green-400/10" : "text-zinc-500 hover:text-zinc-300"}`}
                                        title={sound.label}
                                    >
                                        <Icon className="h-4 w-4" />
                                    </Button>
                                )
                            })
                        )}
                        <div className="flex items-center gap-1 w-[140px]">
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500" onClick={() => setVolume(v => v[0] === 0 ? [0.5] : [0])}>
                                {volume[0] === 0 ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                            </Button>
                            <Slider value={volume} min={0} max={1} step={0.01} onValueChange={setVolume} className="w-full" />
                        </div>
                    </div>
                    
                    <audio ref={audioRef} loop />
                </CardContent>
            </Card>
        </>
    )
}
