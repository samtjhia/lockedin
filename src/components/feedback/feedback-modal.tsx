'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    MessageSquarePlus,
    Bug,
    Lightbulb,
    X,
    Upload,
    Image as ImageIcon,
    Loader2,
    Check,
    Clock,
    CheckCircle,
    XCircle,
    Trash2
} from 'lucide-react'
import {
    submitFeedback,
    getAllFeedback,
    checkIsAdmin,
    updateFeedbackStatus,
    uploadFeedbackScreenshot,
    type Feedback,
    type FeedbackType,
    type FeedbackStatus
} from '@/app/actions/feedback'

export function FeedbackModal() {
    const [open, setOpen] = useState(false)
    const [isAdmin, setIsAdmin] = useState(false)
    const [activeTab, setActiveTab] = useState('submit')

    // Form state
    const [type, setType] = useState<FeedbackType>('bug')
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [screenshot, setScreenshot] = useState<File | null>(null)
    const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)

    // Admin state
    const [allFeedback, setAllFeedback] = useState<Feedback[]>([])
    const [loadingFeedback, setLoadingFeedback] = useState(false)

    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (open) {
            checkIsAdmin().then(setIsAdmin)
        }
    }, [open])

    useEffect(() => {
        if (open && isAdmin && activeTab === 'admin') {
            loadAllFeedback()
        }
    }, [open, isAdmin, activeTab])

    async function loadAllFeedback() {
        setLoadingFeedback(true)
        const data = await getAllFeedback()
        setAllFeedback(data)
        setLoadingFeedback(false)
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (file) {
            setScreenshot(file)
            const reader = new FileReader()
            reader.onloadend = () => {
                setScreenshotPreview(reader.result as string)
            }
            reader.readAsDataURL(file)
        }
    }

    function removeScreenshot() {
        setScreenshot(null)
        setScreenshotPreview(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!title.trim() || !description.trim()) return

        setSubmitting(true)

        try {
            let screenshotUrl: string | undefined

            if (screenshot) {
                const formData = new FormData()
                formData.append('file', screenshot)
                const uploadResult = await uploadFeedbackScreenshot(formData)
                if (uploadResult.url) {
                    screenshotUrl = uploadResult.url
                }
            }

            const result = await submitFeedback(type, title.trim(), description.trim(), screenshotUrl)

            if (result.success) {
                setSubmitted(true)
                setTimeout(() => {
                    resetForm()
                    setOpen(false)
                }, 1500)
            }
        } catch (error) {
            console.error('Error submitting feedback:', error)
        } finally {
            setSubmitting(false)
        }
    }

    function resetForm() {
        setType('bug')
        setTitle('')
        setDescription('')
        setScreenshot(null)
        setScreenshotPreview(null)
        setSubmitted(false)
    }

    async function handleStatusChange(feedbackId: string, newStatus: FeedbackStatus) {
        await updateFeedbackStatus(feedbackId, newStatus)
        loadAllFeedback()
    }

    const getStatusBadge = (status: FeedbackStatus) => {
        switch (status) {
            case 'pending':
                return <Badge variant="outline" className="border-yellow-500/50 text-yellow-400 gap-1"><Clock className="w-3 h-3" />Pending</Badge>
            case 'in-progress':
                return <Badge variant="outline" className="border-blue-500/50 text-blue-400 gap-1"><Loader2 className="w-3 h-3" />In Progress</Badge>
            case 'resolved':
                return <Badge variant="outline" className="border-green-500/50 text-green-400 gap-1"><CheckCircle className="w-3 h-3" />Resolved</Badge>
            case 'closed':
                return <Badge variant="outline" className="border-zinc-500/50 text-zinc-400 gap-1"><XCircle className="w-3 h-3" />Closed</Badge>
        }
    }

    const getTypeBadge = (type: FeedbackType) => {
        return type === 'bug'
            ? <Badge className="bg-red-500/20 text-red-400 border-red-500/30 gap-1"><Bug className="w-3 h-3" />Bug</Badge>
            : <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 gap-1"><Lightbulb className="w-3 h-3" />Feature</Badge>
    }

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                className="text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800"
                onClick={() => setOpen(true)}
                title="Send Feedback"
            >
                <MessageSquarePlus className="h-5 w-5" />
            </Button>

            {open && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
                    onClick={() => setOpen(false)}
                >
                    {/* Modal Container */}
                    <div
                        className="relative bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
                            <h2 className="text-lg font-semibold text-zinc-100">Feedback</h2>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-zinc-500 hover:text-zinc-100"
                                onClick={() => setOpen(false)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Content - Added overflow-y-auto to handle long forms */}
                        <div className="overflow-y-auto custom-scrollbar">
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
                                <TabsList className="mx-5 mt-4 bg-zinc-900/50">
                                    <TabsTrigger value="submit" className="flex-1">Submit</TabsTrigger>
                                    {isAdmin && (
                                        <TabsTrigger value="admin" className="flex-1">
                                            Admin
                                            {allFeedback.filter(f => f.status === 'pending').length > 0 && (
                                                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-red-500 text-white rounded-full">
                                                    {allFeedback.filter(f => f.status === 'pending').length}
                                                </span>
                                            )}
                                        </TabsTrigger>
                                    )}
                                </TabsList>

                                <TabsContent value="submit" className="mt-0 p-5">
                                    {submitted ? (
                                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                                            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                                                <Check className="w-6 h-6 text-green-400" />
                                            </div>
                                            <p className="text-zinc-300 font-medium">Thank you for your feedback!</p>
                                            <p className="text-zinc-500 text-sm">We'll review it soon.</p>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleSubmit} className="space-y-4">
                                            {/* Type Selection */}
                                            <div className="space-y-2">
                                                <Label className="text-zinc-400">Type</Label>
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setType('bug')}
                                                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-all ${type === 'bug'
                                                                ? 'bg-red-500/10 border-red-500/50 text-red-400'
                                                                : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                                                            }`}
                                                    >
                                                        <Bug className="w-4 h-4" />
                                                        Bug Report
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setType('feature')}
                                                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-all ${type === 'feature'
                                                                ? 'bg-purple-500/10 border-purple-500/50 text-purple-400'
                                                                : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                                                            }`}
                                                    >
                                                        <Lightbulb className="w-4 h-4" />
                                                        Feature Request
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Title */}
                                            <div className="space-y-2">
                                                <Label htmlFor="title" className="text-zinc-400">Title</Label>
                                                <Input
                                                    id="title"
                                                    value={title}
                                                    onChange={(e) => setTitle(e.target.value)}
                                                    placeholder={type === 'bug' ? 'Brief description of the bug' : 'What feature would you like?'}
                                                    className="bg-zinc-900/50 border-zinc-800 focus:border-zinc-600"
                                                    required
                                                />
                                            </div>

                                            {/* Description */}
                                            <div className="space-y-2">
                                                <Label htmlFor="description" className="text-zinc-400">Description</Label>
                                                <textarea
                                                    id="description"
                                                    value={description}
                                                    onChange={(e) => setDescription(e.target.value)}
                                                    placeholder={type === 'bug'
                                                        ? 'Steps to reproduce, what happened, what you expected...'
                                                        : 'Describe the feature in detail, why it would be useful...'}
                                                    className="w-full h-28 px-3 py-2 rounded-md bg-zinc-900/50 border border-zinc-800 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 text-zinc-100 placeholder:text-zinc-600 resize-none text-sm"
                                                    required
                                                />
                                            </div>

                                            {/* Screenshot */}
                                            <div className="space-y-2">
                                                <Label className="text-zinc-400">Screenshot (optional)</Label>
                                                {screenshotPreview ? (
                                                    <div className="relative rounded-lg overflow-hidden border border-zinc-800">
                                                        <img
                                                            src={screenshotPreview}
                                                            alt="Screenshot preview"
                                                            className="w-full h-32 object-cover"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={removeScreenshot}
                                                            className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-md hover:bg-black/80 transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4 text-red-400" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className="w-full flex items-center justify-center gap-2 px-4 py-6 rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400 transition-colors"
                                                    >
                                                        <Upload className="w-5 h-5" />
                                                        <span>Click to upload screenshot</span>
                                                    </button>
                                                )}
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleFileChange}
                                                    className="hidden"
                                                />
                                            </div>

                                            {/* Submit Button */}
                                            <Button
                                                type="submit"
                                                className="w-full"
                                                disabled={submitting || !title.trim() || !description.trim()}
                                            >
                                                {submitting ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                        Submitting...
                                                    </>
                                                ) : (
                                                    'Submit Feedback'
                                                )}
                                            </Button>
                                        </form>
                                    )}
                                </TabsContent>

                                {isAdmin && (
                                    <TabsContent value="admin" className="mt-0">
                                        <ScrollArea className="h-[400px]">
                                            <div className="p-5 space-y-3">
                                                {loadingFeedback ? (
                                                    <div className="flex items-center justify-center py-12">
                                                        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
                                                    </div>
                                                ) : allFeedback.length === 0 ? (
                                                    <div className="text-center py-12 text-zinc-500">
                                                        No feedback submitted yet
                                                    </div>
                                                ) : (
                                                    allFeedback.map((item) => (
                                                        <Card key={item.id} className="p-4 bg-zinc-900/50 border-zinc-800">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2 flex-wrap mb-2">
                                                                        {getTypeBadge(item.type)}
                                                                        {getStatusBadge(item.status)}
                                                                    </div>
                                                                    <h4 className="font-medium text-zinc-200 truncate">{item.title}</h4>
                                                                    <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{item.description}</p>
                                                                    <div className="flex items-center gap-2 mt-2 text-xs text-zinc-600">
                                                                        <span>by {item.username || 'Unknown'}</span>
                                                                        <span>•</span>
                                                                        <span>{new Date(item.created_at).toLocaleDateString()}</span>
                                                                    </div>
                                                                    {item.screenshot_url && (
                                                                        <a
                                                                            href={item.screenshot_url}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="inline-flex items-center gap-1 mt-2 text-xs text-blue-400 hover:text-blue-300"
                                                                        >
                                                                            <ImageIcon className="w-3 h-3" />
                                                                            View Screenshot
                                                                        </a>
                                                                    )}
                                                                </div>
                                                                <select
                                                                    value={item.status}
                                                                    onChange={(e) => handleStatusChange(item.id, e.target.value as FeedbackStatus)}
                                                                    className="px-2 py-1 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                                                                >
                                                                    <option value="pending">Pending</option>
                                                                    <option value="in-progress">In Progress</option>
                                                                    <option value="resolved">Resolved</option>
                                                                    <option value="closed">Closed</option>
                                                                </select>
                                                            </div>
                                                        </Card>
                                                    ))
                                                )}
                                            </div>
                                        </ScrollArea>
                                    </TabsContent>
                                )}
                            </Tabs>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
