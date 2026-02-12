'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function searchUsers(searchTerm: string) {
  const supabase = await createClient()
  
  if (!searchTerm || searchTerm.length < 2) {
    return []
  }

  const { data, error } = await supabase.rpc('search_users', { 
    search_term: searchTerm 
  })

  if (error) {
    console.error('Search users error:', error)
    return []
  }

  return data.map((user: any) => ({
    ...user,
    id: user.user_id
  }))
}

export async function getFriends() {
  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc('get_friends')

  if (error) {
    console.error('Get friends error:', error)
    return []
  }

  return data
}

export async function sendFriendRequest(targetUserId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc('send_friend_request', { 
    target_user_id: targetUserId 
  })

  if (error) {
    console.error('Send request error:', error)
    return { success: false, message: error.message }
  }

  revalidatePath('/dashboard')
  return data // { success: boolean, message?: string }
}

export async function acceptFriendRequest(targetUserId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc('accept_friend_request', { 
    target_user_id: targetUserId 
  })

  if (error) {
    console.error('Accept request error:', error)
    return { success: false, message: error.message }
  }

  revalidatePath('/dashboard')
  return data
}

export async function pokeUser(targetUserId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc('poke_user', { 
    target_user_id: targetUserId 
  })

  if (error) {
    console.error('Poke error:', error)
    return { success: false, message: error.message }
  }
  
  return data // { success: boolean, message?: string, remaining_seconds?: number }
}

export async function removeFriend(targetUserId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  // We can just delete the friendship row since "Users can update their own friendships"
  // But wait, the policy is "Users can update their own friendships" (which is usually for accepting/status)
  // Deleting is usually a separate DELETE policy. 
  // Let's check if there is a DELETE policy. If not, we might need to add one or use an RPC if we can't edit migrations easily.
  // Actually, let's assume we can add a delete policy or call an RPC.
  // Since I can't easily add a policy without a migration, and I already have RPCs, I'll use a direct delete query first 
  // and see if it works (assuming RLS allows it or no RLS on delete?). 
  // Wait, migration 12 enabled RLS. 
  // "Users can view their own friendships"
  // "Users can insert friend requests"
  // "Users can update their own friendships"
  // It does NOT have a DELETE policy.
  
  // So I should Make a quick RPC to delete a friend or update status to 'blocked'/'deleted'.
  // Actually, updating to 'blocked' is supported by the check constraint: status IN ('pending', 'accepted', 'blocked').
  // But removing usually means deleting the row so they can request again later.
  
  // Let's create an RPC for remove_friend dynamically if possible? No, I must edit the migration file or create a NEW migration.
  // I'll create a new migration 013_remove_friend.sql.
  
  const { error } = await supabase.rpc('remove_friend', { target_user_id: targetUserId })
  
  if (error) {
    console.error('Remove friend error:', error)
    return { success: false, message: error.message }
  }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function getPendingRequests() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return []

  const { data, error } = await supabase
    .from('friendships')
    .select(`
      id,
      created_at,
      sender:profiles!requester_id (
        id,
        username,
        avatar_url
      )
    `)
    .eq('recipient_id', user.id)
    .eq('status', 'pending')

  if (error) {
    console.error('Get pending requests error:', error)
    return []
  }

  // Transform data to flatten the sender object if needed, or just return as is
  // The UI will expect data.sender to be the profile
  return data.map((item: any) => ({
    id: item.id,
    created_at: item.created_at,
    sender: item.sender
  }))
}
