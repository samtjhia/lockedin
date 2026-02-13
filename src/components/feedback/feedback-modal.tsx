'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
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
    deleteFeedback,
    type Feedback,
    type FeedbackType,
    type FeedbackStatus
} from '@/app/actions/feedback'
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
} from '@/components/ui/alert-dialog'

export function FeedbackModal() {
    const [open, setOpen] = useState(false)
    const [isMounted, setIsMounted] = useState(false)
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
        setIsMounted(true)
    }, [])

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

    async function handleDelete(feedbackId: string) {
        await deleteFeedback(feedbackId)
        loadAllFeedback()
    }

    const getStatusBadge = (status: FeedbackStatus) => {
        switch (status) {
            case 'pending':
                return <Badge variant="outline" className="border-border text-foreground/70 gap-1"><Clock className="w-3 h-3 text-muted-foreground" />Pending</Badge>
            case 'in-progress':
                return <Badge variant="outline" className="border-border text-foreground/70 gap-1"><Loader2 className="w-3 h-3 text-muted-foreground" />In Progress</Badge>
            case 'resolved':
                return <Badge variant="outline" className="border-emerald-500/60 text-emerald-300 gap-1 bg-emerald-500/5"><CheckCircle className="w-3 h-3" />Resolved</Badge>
            case 'closed':
                return <Badge variant="outline" className="border-border text-muted-foreground gap-1"><XCircle className="w-3 h-3 text-muted-foreground" />Closed</Badge>
        }
    }

    const getTypeBadge = (type: FeedbackType) => {
        return (
            <Badge className="bg-card/70 text-foreground border-border gap-1">
                {type === 'bug' ? <Bug className="w-3 h-3 text-red-400" /> : <Lightbulb className="w-3 h-3 text-amber-400" />}
                <span className="capitalize">{type === 'bug' ? 'Bug' : 'Feature'}</span>
            </Badge>
        )
    }

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={() => setOpen(true)}
                title="Send Feedback"
            >
                <MessageSquarePlus className="h-5 w-5" />
            </Button>

            {isMounted && open && createPortal(
                <div
                    className="fixed inset-0 z-[40] flex items-center justify-center bg-background/60 backdrop-blur-md p-4"
                    onClick={() => setOpen(false)}
                >
                    {/* Modal Container */}
                    <div
                        className="relative bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                            <h2 className="text-lg font-semibold text-foreground">Feedback</h2>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => setOpen(false)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Content - Added overflow-y-auto to handle long forms */}
                        <div className="overflow-y-auto custom-scrollbar">
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
                                <TabsList className="mx-5 mt-4 h-10 rounded-lg border border-border bg-card/70 p-1">
                                    <TabsTrigger
                                        value="submit"
                                        className="flex-1 rounded-md text-xs sm:text-sm data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground"
                                    >
                                        Submit
                                    </TabsTrigger>
                                    {isAdmin && (
                                        <TabsTrigger
                                            value="admin"
                                            className="relative flex-1 rounded-md text-xs sm:text-sm data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground"
                                        >
                                            Admin
                                            {allFeedback.filter(f => f.status === 'pending').length > 0 && (
                                                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300 border border-amber-500/40">
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
                                            <p className="text-foreground/70 font-medium">Thank you for your feedback!</p>
                                            <p className="text-muted-foreground text-sm">We'll review it soon.</p>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleSubmit} className="space-y-4">
                                            {/* Type Selection */}
                                            <div className="space-y-2">
                                                <Label className="text-muted-foreground">Type</Label>
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setType('bug')}
                                                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm transition-all ${type === 'bug'
                                                                ? 'bg-muted border-zinc-600 text-foreground'
                                                                : 'bg-card/60 border-border text-muted-foreground hover:border-border'
                                                            }`}
                                                    >
                                                        <Bug className="w-4 h-4 text-red-400" />
                                                        Bug report
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setType('feature')}
                                                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm transition-all ${type === 'feature'
                                                                ? 'bg-muted border-zinc-600 text-foreground'
                                                                : 'bg-card/60 border-border text-muted-foreground hover:border-border'
                                                            }`}
                                                    >
                                                        <Lightbulb className="w-4 h-4 text-amber-400" />
                                                        Feature request
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Title */}
                                            <div className="space-y-2">
                                                <Label htmlFor="title" className="text-muted-foreground">Title</Label>
                                                <Input
                                                    id="title"
                                                    value={title}
                                                    onChange={(e) => setTitle(e.target.value)}
                                                    placeholder={type === 'bug' ? 'Brief description of the bug' : 'What feature would you like?'}
                                                    className="bg-card/50 border-border focus:border-zinc-600"
                                                    required
                                                />
                                            </div>

                                            {/* Description */}
                                            <div className="space-y-2">
                                                <Label htmlFor="description" className="text-muted-foreground">Description</Label>
                                                <textarea
                                                    id="description"
                                                    value={description}
                                                    onChange={(e) => setDescription(e.target.value)}
                                                    placeholder={type === 'bug'
                                                        ? 'Steps to reproduce, what happened, what you expected...'
                                                        : 'Describe the feature in detail, why it would be useful...'}
                                                    className="w-full h-28 px-3 py-2 rounded-md bg-card/50 border border-border focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 text-foreground placeholder:text-muted-foreground resize-none text-sm"
                                                    required
                                                />
                                            </div>

                                            {/* Screenshot */}
                                            <div className="space-y-2">
                                                <Label className="text-muted-foreground">Screenshot (optional)</Label>
                                                {screenshotPreview ? (
                                                    <div className="relative rounded-lg overflow-hidden border border-border">
                                                        <img
                                                            src={screenshotPreview}
                                                            alt="Screenshot preview"
                                                            className="w-full h-32 object-cover"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={removeScreenshot}
                                                            className="absolute top-2 right-2 p-1.5 bg-background/60 rounded-md hover:bg-background/80 transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4 text-red-400" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className="w-full flex items-center justify-center gap-2 px-4 py-6 rounded-lg border border-dashed border-border bg-card/30 text-muted-foreground hover:border-border hover:text-muted-foreground transition-colors"
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
                                                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                                    </div>
                                                ) : allFeedback.length === 0 ? (
                                                    <div className="text-center py-12 text-muted-foreground">
                                                        No feedback submitted yet
                                                    </div>
                                                ) : (
                                                    allFeedback.map((item) => (
                                                        <Card key={item.id} className="p-4 bg-card/50 border-border">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2 flex-wrap mb-2">
                                                                        {getTypeBadge(item.type)}
                                                                        {getStatusBadge(item.status)}
                                                                    </div>
                                                                    <h4 className="font-medium text-foreground truncate">{item.title}</h4>
                                                                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                                                                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
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
                                                                <div className="flex flex-col items-end gap-2">
                                                                    <select
                                                                        value={item.status}
                                                                        onChange={(e) => handleStatusChange(item.id, e.target.value as FeedbackStatus)}
                                                                        className="px-2 py-1 text-xs bg-muted border border-border rounded text-foreground/70 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                                                                    >
                                                                        <option value="pending">Pending</option>
                                                                        <option value="in-progress">In Progress</option>
                                                                        <option value="resolved">Resolved</option>
                                                                        <option value="closed">Closed</option>
                                                                    </select>
                                                                    <AlertDialog>
                                                                        <AlertDialogTrigger asChild>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                                                                                title="Delete report"
                                                                            >
                                                                                <Trash2 className="h-3 w-3" />
                                                                            </Button>
                                                                        </AlertDialogTrigger>
                                                                        <AlertDialogContent className="bg-card border-border text-foreground">
                                                                            <AlertDialogHeader>
                                                                                <AlertDialogTitle className="text-foreground">
                                                                                    Delete feedback?
                                                                                </AlertDialogTitle>
                                                                                <AlertDialogDescription className="text-muted-foreground">
                                                                                    This will permanently remove this feedback report. This action cannot be undone.
                                                                                </AlertDialogDescription>
                                                                            </AlertDialogHeader>
                                                                            <AlertDialogFooter>
                                                                                <AlertDialogCancel className="bg-transparent border-border text-foreground/70 hover:bg-muted hover:text-foreground">
                                                                                    Cancel
                                                                                </AlertDialogCancel>
                                                                                <AlertDialogAction
                                                                                    className="bg-red-600 text-foreground hover:bg-red-700 border-none"
                                                                                    onClick={() => handleDelete(item.id)}
                                                                                >
                                                                                    Delete
                                                                                </AlertDialogAction>
                                                                            </AlertDialogFooter>
                                                                        </AlertDialogContent>
                                                                    </AlertDialog>
                                                                </div>
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
                </div>,
                document.body
            )}
        </>
    )
}
