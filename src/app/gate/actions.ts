'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function verifySecretCode(formData: FormData) {
  const code = formData.get('code') as string
  const username = formData.get('username') as string
  const factorySecret = process.env.FACTORY_SECRET_CODE

  if (!code || code !== factorySecret) {
    return redirect('/gate?error=Invalid security code')
  }

  if (!username || username.trim().length < 3) {
    return redirect('/gate?error=Username must be at least 3 characters')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
  }

  // Check if username is taken (optional but recommended)
  const { data: existingUser } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .neq('id', user.id) // excluding self
    .single()

  if (existingUser) {
    return redirect('/gate?error=Username is already taken')
  }

  // Update user profile to verified and set username
  const { error } = await supabase
    .from('profiles')
    .update({ 
      is_verified: true,
      username: username 
    })
    .eq('id', user.id)

  if (error) {
    console.error('Verification error:', error)
    return redirect('/gate?error=Something went wrong. Please try again.')
  }

  redirect('/dashboard')
}
