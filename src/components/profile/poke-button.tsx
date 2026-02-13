'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Hand, Loader2 } from 'lucide-react'
import { pokeUser } from '@/app/actions/social'
import { toast } from 'sonner'

type PokeButtonProps = {
  targetUserId: string
  targetUsername: string
}

export function PokeButton({ targetUserId, targetUsername }: PokeButtonProps) {
  const [poking, setPoking] = useState(false)

  async function handlePoke() {
    setPoking(true)
    try {
      const res = await pokeUser(targetUserId)
      if (res.success) {
        toast.success(`You poked ${targetUsername}!`)
      } else {
        if (res.message?.includes('Cooldown')) {
          const minutes = Math.ceil((res.remaining_seconds || 0) / 60)
          toast.info(`Wait ${minutes}m to poke again`)
        } else {
          toast.error(res.message || 'Failed to poke')
        }
      }
    } catch {
      toast.error('Error poking user')
    } finally {
      setPoking(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="border-border text-foreground hover:bg-muted shrink-0"
      onClick={handlePoke}
      disabled={poking}
    >
      {poking ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Hand className="h-3.5 w-3.5" />
      )}
      <span className="ml-1.5">Poke</span>
    </Button>
  )
}
