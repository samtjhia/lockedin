'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export type FeedbackType = 'bug' | 'feature'
export type FeedbackStatus = 'pending' | 'in-progress' | 'resolved' | 'closed'

export type Feedback = {
    id: string
    user_id: string
    username?: string
    avatar_url?: string
    type: FeedbackType
    title: string
    description: string
    screenshot_url?: string
    status: FeedbackStatus
    admin_notes?: string
    created_at: string
    updated_at: string
}

export async function submitFeedback(
    type: FeedbackType,
    title: string,
    description: string,
    screenshotUrl?: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { success: false, error: 'Not authenticated' }
    }
    
    const { error } = await supabase
        .from('feedback')
        .insert({
            user_id: user.id,
            type,
            title,
            description,
            screenshot_url: screenshotUrl || null
        })
    
    if (error) {
        console.error('Error submitting feedback:', error)
        return { success: false, error: error.message }
    }
    
    return { success: true }
}

export async function getMyFeedback(): Promise<Feedback[]> {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    
    const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
    
    if (error) {
        console.error('Error fetching feedback:', error)
        return []
    }
    
    return data || []
}

export async function checkIsAdmin(): Promise<boolean> {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    
    const { data } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()
    
    return data?.is_admin ?? false
}

export async function getAllFeedback(): Promise<Feedback[]> {
    const supabase = await createClient()
    
    const { data, error } = await supabase.rpc('get_all_feedback')
    
    if (error) {
        console.error('Error fetching all feedback:', error)
        return []
    }
    
    return data || []
}

export async function updateFeedbackStatus(
    feedbackId: string,
    status: FeedbackStatus,
    adminNotes?: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    
    // Verify admin
    const isAdmin = await checkIsAdmin()
    if (!isAdmin) {
        return { success: false, error: 'Unauthorized' }
    }
    
    const { error } = await supabase
        .from('feedback')
        .update({
            status,
            admin_notes: adminNotes || null,
            updated_at: new Date().toISOString()
        })
        .eq('id', feedbackId)
    
    if (error) {
        console.error('Error updating feedback:', error)
        return { success: false, error: error.message }
    }
    
    return { success: true }
}

export async function deleteFeedback(
    feedbackId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()

    // Verify admin
    const isAdmin = await checkIsAdmin()
    if (!isAdmin) {
        return { success: false, error: 'Unauthorized' }
    }

    const { error } = await supabase
        .from('feedback')
        .delete()
        .eq('id', feedbackId)

    if (error) {
        console.error('Error deleting feedback:', error)
        return { success: false, error: error.message }
    }

    return { success: true }
}

export async function uploadFeedbackScreenshot(formData: FormData): Promise<{ url?: string; error?: string }> {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { error: 'Not authenticated' }
    }
    
    const file = formData.get('file') as File
    if (!file) {
        return { error: 'No file provided' }
    }
    
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}/${Date.now()}.${fileExt}`
    
    const { error } = await supabase.storage
        .from('feedback')
        .upload(fileName, file)
    
    if (error) {
        console.error('Error uploading screenshot:', error)
        return { error: error.message }
    }
    
    const { data: { publicUrl } } = supabase.storage
        .from('feedback')
        .getPublicUrl(fileName)
    
    return { url: publicUrl }
}
