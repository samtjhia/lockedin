'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LogOut, Moon, Sun, User } from 'lucide-react'
import { useTheme } from '@/components/theme/theme-provider'

type MinimalProfile = {
  id: string
  username: string | null
  avatar_url: string | null
}

export function ProfileMenu() {
  const router = useRouter()
  const supabase = createClient()
  const { theme, toggleTheme } = useTheme()
  const [profile, setProfile] = useState<MinimalProfile | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || !isMounted) return

      const { data } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .eq('id', user.id)
        .single()

      if (isMounted && data) {
        setProfile(data as MinimalProfile)
      }
    }

    loadProfile()

    return () => {
      isMounted = false
    }
  }, [supabase])

  const initials =
    profile?.username?.substring(0, 2).toUpperCase() ??
    (profile?.id ? profile.id.substring(0, 2).toUpperCase() : '?')

  const handleViewProfile = () => {
    if (profile?.id) {
      router.push(`/profile/${encodeURIComponent(profile.id)}`)
    } else {
      router.push('/profile')
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full border border-zinc-800 bg-zinc-950/40 hover:bg-zinc-900/80 hover:border-zinc-700"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 bg-zinc-950 border-zinc-800 text-zinc-100 shadow-xl"
      >
        <DropdownMenuLabel className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {profile?.username ?? 'Locked In User'}
            </span>
            <span className="text-xs text-zinc-500">View and manage your account</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="flex items-center gap-2 text-sm cursor-pointer"
          onClick={handleViewProfile}
        >
          <User className="h-4 w-4" />
          <span>View profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="flex items-center justify-between text-sm cursor-pointer"
          onClick={toggleTheme}
        >
          <div className="flex items-center gap-2">
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
            <span>Theme</span>
          </div>
          <span className="text-xs text-zinc-400 capitalize">{theme}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="flex items-center gap-2 text-sm text-red-400 cursor-pointer focus:bg-red-500/10 focus:text-red-300"
          onClick={() => router.push('/logout')}
        >
          <LogOut className="h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

