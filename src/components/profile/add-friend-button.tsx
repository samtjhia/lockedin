'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { UserPlus, Loader2, Check } from 'lucide-react'
import { sendFriendRequest } from '@/app/actions/social'
import { toast } from 'sonner'

type AddFriendButtonProps = {
  targetUserId: string
  targetUsername: string
}

export function AddFriendButton({ targetUserId, targetUsername }: AddFriendButtonProps) {
  const [loading, setLoading] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const router = useRouter()

  async function handleAddFriend() {
    setLoading(true)
    try {
      const res = await sendFriendRequest(targetUserId)
      if (res?.success !== false) {
        toast.success(`Friend request sent to ${targetUsername}!`)
        setRequestSent(true)
        router.refresh()
      } else {
        toast.error((res as { message?: string }).message || 'Failed to send request')
      }
    } catch {
      toast.error('Error sending friend request')
    } finally {
      setLoading(false)
    }
  }

  if (requestSent) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="border-border text-muted-foreground shrink-0"
        disabled
      >
        <Check className="h-3.5 w-3.5" />
        <span className="ml-1.5">Request sent</span>
      </Button>
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="border-border text-foreground hover:bg-muted shrink-0"
      onClick={handleAddFriend}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <UserPlus className="h-3.5 w-3.5" />
      )}
      <span className="ml-1.5">Add friend</span>
    </Button>
  )
}
