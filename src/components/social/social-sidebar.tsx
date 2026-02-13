'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { 
  searchUsers, 
  getFriends, 
  getPendingRequests, 
  sendFriendRequest, 
  acceptFriendRequest, 
  pokeUser,
  removeFriend,
  getUnseenPokes,
  markPokesSeen
} from '@/app/actions/social'
import { UserPlus, Users, Bell, Hand, Search, Loader2, X, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { createClient } from '@/utils/supabase/client'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

type Profile = {
    id: string
    username: string
    avatar_url?: string
}
// ... rest of implementation ...


type Friend = {
    user_id: string
    username: string
    avatar_url?: string
    current_status: 'active' | 'paused' | 'offline'
    current_task?: string
    last_active_at?: string
}

type Request = {
    id: string
    sender: Profile
}

type PokeNotification = {
    poke_id: string
    sender_id: string
    sender_username: string
    sender_avatar_url: string | null
    poked_at: string
}

export function SocialSidebar() {
    const [isOpen, setIsOpen] = useState(false)
    const [isMounted, setIsMounted] = useState(false)
    const [friends, setFriends] = useState<Friend[]>([])
    const [requests, setRequests] = useState<Request[]>([])
    const [pokes, setPokes] = useState<PokeNotification[]>([])
    const [searchResults, setSearchResults] = useState<Profile[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [loading, setLoading] = useState(false)
    const [searching, setSearching] = useState(false)
    const supabase = createClient()

    // Initial Load & Realtime Setup
    useEffect(() => {
        setIsMounted(true)
    }, [])

    useEffect(() => {
        refreshData()

        const channel = supabase.channel('social_updates')
        
        // Listen for new pokes
        // We need user ID for filter, but since RLS protects reads, we can potentially just listen to all INSERTs 
        // that RLS allows us to see? No, supabase realtime doesn't filter by RLS automatically like that for INSERT events usually unless configured with Row Level Security and "broadcast" is disabled?
        // Actually, best practice is filtering by a column.
        // For now, let's fetch user first.
        
        const setupRealtime = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // 1. Listen for Pokes
            channel.on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'pokes',
                filter: `receiver_id=eq.${user.id}`
            }, (payload) => {
                toast("👉 Get back to work!", {
                    description: "You've been poked by a friend.",
                    action: {
                        label: "Sorry!",
                        onClick: () => console.log("Acknowledged")
                    }
                })
                // Refresh to pick up the new poke notification
                refreshData()
            })

            // 2. Listen for Friend Request updates (accepted)
            channel.on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'friendships',
                filter: `requester_id=eq.${user.id}`
            }, () => {
                refreshData()
                toast.success("Friend request accepted!")
            })

             // 3. Listen for Incoming Requests
            channel.on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'friendships',
                filter: `recipient_id=eq.${user.id}`
            }, () => {
                refreshData()
                toast.info("New friend request received")
            })

            channel.subscribe()
        }

        setupRealtime()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    const refreshData = async () => {
        setLoading(true)
        try {
            const [friendsData, requestsData, pokesData] = await Promise.all([
                getFriends(),
                getPendingRequests(),
                getUnseenPokes()
            ])
            setFriends(friendsData || [])
            setRequests(requestsData || [])
            setPokes(pokesData || [])
        } catch (error) {
            console.error(error)
            toast.error("Failed to load social data")
        } finally {
            setLoading(false)
        }
    }

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (searchTerm.length < 2) return
        setSearching(true)
        try {
            const results = await searchUsers(searchTerm)
            setSearchResults(results || [])
        } catch (error) {
            toast.error("Search failed")
        } finally {
            setSearching(false)
        }
    }

    const handleSendRequest = async (userId: string) => {
        try {
            const res = await sendFriendRequest(userId)
            if (res.success) {
                toast.success("Friend request sent!")
                setSearchResults(prev => prev.filter(u => u.id !== userId))
            } else {
                toast.error(res.message || "Failed to send request")
            }
        } catch (error) {
            toast.error("Error sending request")
        }
    }

    const handleAcceptRequest = async (userId: string) => {
        try {
            const res = await acceptFriendRequest(userId)
            if (res.success) {
                toast.success("Friend request accepted!")
                refreshData() // Reload friends and requests
            } else {
                toast.error(res.message || "Failed to accept request")
            }
        } catch (error) {
            toast.error("Error accepting request")
        }
    }

    const handlePoke = async (userId: string, username: string) => {
        try {
            const res = await pokeUser(userId)
            if (res.success) {
                toast.success(`You poked ${username}!`)
            } else {
                if (res.message?.includes("Cooldown")) {
                    const minutes = Math.ceil((res.remaining_seconds || 0) / 60)
                    toast.info(`Wait ${minutes}m to poke again`)
                } else {
                    toast.error(res.message || "Failed to poke")
                }
            }
        } catch (error) {
            toast.error("Error poking user")
        }
    }

    const handleRemoveFriend = async (userId: string) => {
        try {
            const res = await removeFriend(userId)
            if (res.success) {
                toast.success("Friend removed")
                refreshData()
            } else {
                toast.error(res.message || "Failed to remove friend")
            }
        } catch (error) {
            toast.error("Error removing friend")
        }
    }

    return (
        <>
            {/* Trigger Button */}
            <Button 
                variant="outline" 
                className="text-foreground border-border bg-transparent hover:bg-muted hover:text-foreground relative"
                onClick={() => setIsOpen(true)}
            >
                <Users className="h-4 w-4 mr-2" />
                Social
                {(requests.length + pokes.length) > 0 && (
                    <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse ring-2 ring-background" />
                )}
            </Button>

            {isMounted ? createPortal(
                <>
                    {/* Backdrop */}
                    {isOpen && (
                        <div 
                            className="fixed inset-0 bg-background/50 z-[60] backdrop-blur-sm transition-opacity"
                            onClick={() => setIsOpen(false)}
                        />
                    )}

                    {/* Drawer Panel */}
                    <div className={`fixed inset-y-0 right-0 z-[70] w-full sm:w-[400px] bg-background border-l border-border shadow-2xl transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                        <div className="flex flex-col h-full">
                            {/* Header */}
                            <div className="p-4 border-b border-border flex items-center justify-between bg-card/50">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-lg font-semibold text-foreground">Social Hub</h2>
                                    {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-hidden">
                                <Tabs defaultValue="friends" className="w-full h-full flex flex-col">
                                    <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent p-0 h-10">
                                        <TabsTrigger value="friends" className="flex-1 rounded-none border-b-2 border-transparent text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-yellow-500 data-[state=active]:bg-card/50 h-10">
                                            Friends
                                        </TabsTrigger>
                                        <TabsTrigger value="requests" className="flex-1 rounded-none border-b-2 border-transparent text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-yellow-500 data-[state=active]:bg-card/50 h-10">
                                            Notifs {(requests.length + pokes.length) > 0 && `(${requests.length + pokes.length})`}
                                        </TabsTrigger>
                                        <TabsTrigger value="add" className="flex-1 rounded-none border-b-2 border-transparent text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-yellow-500 data-[state=active]:bg-card/50 h-10">
                                            Add
                                        </TabsTrigger>
                                    </TabsList>

                            {/* FRIENDS LIST */}
                            <TabsContent value="friends" className="flex-1 overflow-y-auto p-4 m-0 space-y-4">
                                {friends.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground">
                                        <Users className="h-8 w-8 mb-2 opacity-50" />
                                        <p>No friends yet.</p>
                                        <Button variant="link" className="text-yellow-500" onClick={() => (document.querySelector('[value="add"]') as HTMLElement)?.click()}>
                                            Find people
                                        </Button>
                                    </div>
                                ) : (
                                    friends.map(friend => (
                                        <div
                                            key={friend.user_id}
                                            className="flex items-center justify-between group p-2 hover:bg-card/50 rounded-lg transition-colors cursor-pointer"
                                            onClick={() => {
                                                setIsOpen(false)
                                                window.location.href = `/profile/${encodeURIComponent(friend.user_id)}`
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <Avatar className="h-10 w-10 border border-border">
                                                        <AvatarImage src={friend.avatar_url || ''} />
                                                        <AvatarFallback>{friend.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                    <div className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${
                                                        friend.current_status === 'active' ? 'bg-green-500' :
                                                        friend.current_status === 'paused' ? 'bg-yellow-500' : 'bg-zinc-500'
                                                    }`} />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm text-foreground">{friend.username}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {friend.current_status === 'active' ? (friend.current_task || 'Focusing') : 
                                                         friend.current_status === 'paused' ? 'Paused' : 'Offline'}
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            <div className="flex gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10"
                                                    onClick={(e) => { e.stopPropagation(); handlePoke(friend.user_id, friend.username) }}
                                                    title="Poke"
                                                >
                                                    <Hand className="h-4 w-4 rotate-90" />
                                                </Button>
                                                
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                                                            title="Remove Friend"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="bg-card border-border text-foreground">
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle className="text-foreground">Remove Friend?</AlertDialogTitle>
                                                            <AlertDialogDescription className="text-muted-foreground">
                                                                Are you sure you want to remove {friend.username} from your friends list? 
                                                                This action cannot be undone.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel className="bg-transparent border-border text-foreground/70 hover:bg-muted hover:text-foreground">Cancel</AlertDialogCancel>
                                                            <AlertDialogAction 
                                                                className="bg-red-600 text-foreground hover:bg-red-700 border-none"
                                                                onClick={() => handleRemoveFriend(friend.user_id)}
                                                            >
                                                                Remove
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </TabsContent>

                            {/* NOTIFICATIONS (POKES + REQUESTS) */}
                            <TabsContent value="requests" className="flex-1 overflow-y-auto p-4 m-0 space-y-4">
                                {/* Poke notifications */}
                                {pokes.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pokes</p>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 text-xs text-muted-foreground hover:text-foreground"
                                                onClick={async () => {
                                                    await markPokesSeen()
                                                    setPokes([])
                                                }}
                                            >
                                                Clear all
                                            </Button>
                                        </div>
                                        {pokes.map(poke => (
                                            <div
                                                key={poke.poke_id}
                                                className="flex items-center gap-3 bg-yellow-500/5 border border-yellow-500/20 p-3 rounded-lg cursor-pointer hover:bg-yellow-500/10 transition-colors"
                                                onClick={() => {
                                                    setIsOpen(false)
                                                    window.location.href = `/profile/${encodeURIComponent(poke.sender_id)}`
                                                }}
                                            >
                                                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-yellow-500/10 shrink-0">
                                                    <Hand className="h-4 w-4 text-yellow-500 rotate-90" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm text-foreground">
                                                        <span className="font-medium">{poke.sender_username}</span>{' '}
                                                        <span className="text-muted-foreground">poked you</span>
                                                    </p>
                                                    <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                                                        {formatDistanceToNow(new Date(poke.poked_at), { addSuffix: true })}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Friend requests */}
                                {requests.length > 0 && (
                                    <div className="space-y-2">
                                        {pokes.length > 0 && (
                                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-2">Friend Requests</p>
                                        )}
                                        {requests.map(req => (
                                            <div key={req.id} className="flex items-center justify-between bg-card/50 p-3 rounded-lg border border-border">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarImage src={req.sender.avatar_url || ''} />
                                                        <AvatarFallback>{req.sender.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                    <p className="text-sm font-medium text-foreground">{req.sender.username}</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button size="sm" onClick={() => handleAcceptRequest(req.sender.id)}>
                                                        Accept
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Empty state */}
                                {requests.length === 0 && pokes.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground">
                                        <Bell className="h-8 w-8 mb-2 opacity-50" />
                                        <p>No notifications.</p>
                                    </div>
                                )}
                            </TabsContent>

                            {/* ADD FRIEND / SEARCH */}
                            <TabsContent value="add" className="flex-1 overflow-y-auto p-4 m-0">
                                <form onSubmit={handleSearch} className="flex gap-2 mb-6">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input 
                                            placeholder="Search username..." 
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="bg-card border-border pl-9"
                                        />
                                    </div>
                                    <Button type="submit" disabled={searching}>
                                        {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
                                    </Button>
                                </form>

                                <div className="space-y-2">
                                    {searchResults.map(user => (
                                        <div key={user.id} className="flex items-center justify-between p-3 bg-card/30 rounded-lg border border-border/50">
                                             <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={user.avatar_url || ''} />
                                                    <AvatarFallback>{user.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                <p className="text-sm font-medium text-foreground">{user.username}</p>
                                            </div>
                                            <Button size="sm" variant="secondary" onClick={() => handleSendRequest(user.id)}>
                                                Add Friend
                                            </Button>
                                        </div>
                                    ))}
                                    {searchResults.length === 0 && !searching && searchTerm && (
                                        <p className="text-center text-muted-foreground text-sm py-4">No users found.</p>
                                    )}
                                </div>
                            </TabsContent>
                                </Tabs>
                            </div>
                        </div>
                    </div>
                </>,
                document.body
            ) : null}
        </>
    )
}
