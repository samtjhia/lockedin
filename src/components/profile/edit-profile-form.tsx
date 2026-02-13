'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Camera, Loader2 } from 'lucide-react'
import { ImageCropModal } from './image-crop-modal'

type EditProfileFormProps = {
  username: string
  avatarUrl: string | null
  bio: string
  goals: string
  initials: string
}

export function EditProfileForm({ username, avatarUrl, bio, goals, initials }: EditProfileFormProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(avatarUrl)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Read the file and open the crop modal
    const reader = new FileReader()
    reader.onloadend = () => {
      setCropSrc(reader.result as string)
    }
    reader.readAsDataURL(file)

    // Reset input so the same file can be re-selected
    e.target.value = ''
  }

  function handleCropComplete(blob: Blob) {
    const file = new File([blob], 'avatar.webp', { type: 'image/webp' })
    setSelectedFile(file)
    setPreview(URL.createObjectURL(blob))
    setCropSrc(null)
  }

  function handleCropCancel() {
    setCropSrc(null)
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
          <Avatar className="h-16 w-16 border border-border">
            <AvatarImage src={preview || undefined} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="absolute inset-0 rounded-full bg-background/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="h-5 w-5 text-foreground" />
          </div>
        </button>
        <div className="space-y-1">
          <p className="text-sm text-foreground">Profile photo</p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
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
          className="text-xs font-medium text-muted-foreground"
        >
          Display name
        </label>
        <Input
          id="username"
          name="username"
          defaultValue={username}
          placeholder="Your display name"
          className="bg-card/60 border-border"
        />
        <p className="text-[11px] text-muted-foreground">
          This is how your name appears on your profile and leaderboard.
        </p>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="bio"
          className="text-xs font-medium text-muted-foreground"
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
          className="w-full px-3 py-2 rounded-md bg-card/60 border border-border focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 text-foreground placeholder:text-muted-foreground resize-none text-sm"
        />
        <p className="text-[11px] text-muted-foreground">
          Max 160 characters. Shown on your public profile.
        </p>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="goals"
          className="text-xs font-medium text-muted-foreground"
        >
          What I&apos;m prepping for
        </label>
        <textarea
          id="goals"
          name="goals"
          defaultValue={goals}
          placeholder={"e.g.\n• CFA exam in May\n• Building a SaaS app\n• Learning system design"}
          maxLength={500}
          rows={4}
          className="w-full px-3 py-2 rounded-md bg-card/60 border border-border focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 text-foreground placeholder:text-muted-foreground resize-none text-sm"
        />
        <p className="text-[11px] text-muted-foreground">
          Let people know what you&apos;re working towards. Keeps you accountable.
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

      {cropSrc && (
        <ImageCropModal
          imageSrc={cropSrc}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
    </form>
  )
}
