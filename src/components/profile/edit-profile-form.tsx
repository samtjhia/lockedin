'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Camera, Loader2 } from 'lucide-react'

type EditProfileFormProps = {
  username: string
  avatarUrl: string | null
  bio: string
  initials: string
}

export function EditProfileForm({ username, avatarUrl, bio, initials }: EditProfileFormProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(avatarUrl)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)

    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)

    try {
      const formData = new FormData(e.currentTarget)

      if (selectedFile) {
        formData.set('avatar', selectedFile)
      }

      const res = await fetch('/api/profile/update', {
        method: 'POST',
        body: formData,
      })

      if (res.redirected) {
        router.push(res.url)
      } else {
        router.push('/profile')
      }
      router.refresh()
    } catch (error) {
      console.error('Error saving profile:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="relative group"
        >
          <Avatar className="h-16 w-16 border border-zinc-700">
            <AvatarImage src={preview || undefined} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="h-5 w-5 text-white" />
          </div>
        </button>
        <div className="space-y-1">
          <p className="text-sm text-zinc-200">Profile photo</p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Click to upload a new photo
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="username"
          className="text-xs font-medium text-zinc-400"
        >
          Display name
        </label>
        <Input
          id="username"
          name="username"
          defaultValue={username}
          placeholder="Your display name"
          className="bg-zinc-900/60 border-zinc-800"
        />
        <p className="text-[11px] text-zinc-500">
          This is how your name appears on your profile and leaderboard.
        </p>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="bio"
          className="text-xs font-medium text-zinc-400"
        >
          Bio
        </label>
        <textarea
          id="bio"
          name="bio"
          defaultValue={bio}
          placeholder="Tell people a little about yourself..."
          maxLength={160}
          rows={3}
          className="w-full px-3 py-2 rounded-md bg-zinc-900/60 border border-zinc-800 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 text-zinc-100 placeholder:text-zinc-600 resize-none text-sm"
        />
        <p className="text-[11px] text-zinc-500">
          Max 160 characters. Shown on your public profile.
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          'Save changes'
        )}
      </Button>
    </form>
  )
}
