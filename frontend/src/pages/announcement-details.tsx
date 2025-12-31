import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { HomeFooter } from '@/components/home/home-footer'
import { AppHeader } from '@/components/layout/app-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { Announcement } from '@/lib/announcements-api'
import { getAnnouncement } from '@/lib/announcements-api'
import { ApiError } from '@/lib/api-error'
import type { Feedback } from '@/lib/feedback-api'
import { createFeedback, listFeedbackForAnnouncement } from '@/lib/feedback-api'

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

function formatRelativeDays(isoString?: string | null) {
  if (!isoString) return '—'
  const d = new Date(isoString)
  if (Number.isNaN(d.getTime())) return '—'
  const diffMs = Date.now() - d.getTime()
  const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

export function AnnouncementDetailsPage() {
  const params = useParams()
  const announcementId = params.id || ''

  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const [isLoadingAnnouncement, setIsLoadingAnnouncement] = useState<boolean>(true)
  const [announcementError, setAnnouncementError] = useState<string | null>(null)

  useEffect(() => {
    if (!announcementId) return

    let cancelled = false
    async function run() {
      setIsLoadingAnnouncement(true)
      setAnnouncementError(null)
      try {
        const a = await getAnnouncement(announcementId)
        if (cancelled) return
        setAnnouncement(a)
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError) setAnnouncementError(err.message)
        else if (err instanceof Error) setAnnouncementError(err.message)
        else setAnnouncementError('Failed to load announcement.')
        setAnnouncement(null)
      } finally {
        if (!cancelled) setIsLoadingAnnouncement(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [announcementId])

  const [feedbackItems, setFeedbackItems] = useState<Feedback[]>([])
  const [isLoadingFeedback, setIsLoadingFeedback] = useState<boolean>(true)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)
  const [reactionType, setReactionType] = useState<string>('positive')
  const [rating, setRating] = useState<string>('')
  const [comment, setComment] = useState<string>('')
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false)
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState<boolean>(false)

  useEffect(() => {
    if (!announcementId) return

    let cancelled = false
    async function run() {
      setIsLoadingFeedback(true)
      setFeedbackError(null)
      try {
        const res = await listFeedbackForAnnouncement(announcementId, { limit: 50, offset: 0 })
        if (cancelled) return
        setFeedbackItems(Array.isArray(res.feedback) ? res.feedback : [])
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError) setFeedbackError(err.message)
        else if (err instanceof Error) setFeedbackError(err.message)
        else setFeedbackError('Failed to load feedback.')
        setFeedbackItems([])
      } finally {
        if (!cancelled) setIsLoadingFeedback(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [announcementId])

  if (!announcementId) {
    return (
      <div className="min-h-screen bg-slate-100 text-foreground">
        <AppHeader />
        <main>
          <div className="mx-auto max-w-4xl px-4 pb-10 pt-6">
            <Card className="rounded-2xl bg-white shadow-md">
              <CardHeader>
                <CardTitle>Missing announcement id</CardTitle>
                <CardDescription>Open an announcement from the home page.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="rounded-full bg-white">
                  <Link to="/">Back</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
        <HomeFooter />
      </div>
    )
  }

  if (isLoadingAnnouncement) {
    return (
      <div className="min-h-screen bg-slate-100 text-foreground">
        <AppHeader />
        <main>
          <div className="mx-auto max-w-4xl px-4 pb-10 pt-6">
            <Card className="rounded-2xl bg-white shadow-md">
              <CardHeader>
                <CardTitle>Loading announcement...</CardTitle>
                <CardDescription>Please wait.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="rounded-full bg-white">
                  <Link to="/">Back</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
        <HomeFooter />
      </div>
    )
  }

  if (announcementError) {
    return (
      <div className="min-h-screen bg-slate-100 text-foreground">
        <AppHeader />
        <main>
          <div className="mx-auto max-w-4xl px-4 pb-10 pt-6">
            <Card className="rounded-2xl bg-white shadow-md">
              <CardHeader>
                <CardTitle>Could not load announcement</CardTitle>
                <CardDescription className="text-destructive">{announcementError}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="rounded-full bg-white">
                  <Link to="/">Back</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
        <HomeFooter />
      </div>
    )
  }

  if (!announcement) {
    return (
      <div className="min-h-screen bg-slate-100 text-foreground">
        <AppHeader />
        <main>
          <div className="mx-auto max-w-4xl px-4 pb-10 pt-6">
            <Card className="rounded-2xl bg-white shadow-md">
              <CardHeader>
                <CardTitle>Announcement not found</CardTitle>
                <CardDescription>The announcement you requested does not exist.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="rounded-full bg-white">
                  <Link to="/">Back</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
        <HomeFooter />
      </div>
    )
  }

  const category = announcement.category ?? 'General'
  const priority = announcement.priority

  return (
    <div className="min-h-screen bg-slate-100 text-foreground">
      <AppHeader />

      <main>
        <div className="mx-auto max-w-4xl px-4 pb-10 pt-6">
          <div className="mb-4">
            <Button asChild variant="ghost" className="rounded-full">
              <Link to="/">Back</Link>
            </Button>
          </div>

          <Card className="rounded-2xl bg-white border-primary/20 shadow-md">
            <CardHeader className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{category}</Badge>
                {priority === 'high' ? <Badge>High Priority</Badge> : null}
                {announcement.status ? <Badge variant="outline">{announcement.status}</Badge> : null}
              </div>
              <CardTitle className="text-2xl">{announcement.title}</CardTitle>
              <CardDescription>
                Published: {formatDateTime(announcement.publishedAt)} • Updated: {formatDateTime(announcement.updatedAt)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap leading-relaxed text-slate-800">{announcement.content}</div>

              <div className="mt-6 grid grid-cols-1 gap-3 rounded-xl border bg-slate-50 p-4 sm:grid-cols-3">
                <div>
                  <div className="text-xs text-muted-foreground">Type</div>
                  <div className="text-sm font-medium">{announcement.type}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Created</div>
                  <div className="text-sm font-medium">{formatDateTime(announcement.createdAt)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Audience</div>
                  <div className="text-sm font-medium">
                    {announcement.targetAudience?.departments?.length
                      ? announcement.targetAudience.departments.join(', ')
                      : 'All'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="mt-8 grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <Card className="rounded-2xl bg-white border-primary/20 shadow-md">
                <CardHeader>
                  <CardTitle>Feedback</CardTitle>
                  <CardDescription>
                    {isLoadingFeedback ? 'Loading...' : feedbackError ? '—' : `${feedbackItems.length} responses`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {feedbackError ? (
                    <div className="text-sm text-destructive">{feedbackError}</div>
                  ) : isLoadingFeedback ? (
                    <div className="text-sm text-muted-foreground">Loading feedback...</div>
                  ) : feedbackItems.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No feedback yet. Be the first to share.</div>
                  ) : (
                    feedbackItems.map((f) => (
                      <Card key={f.id} className="rounded-xl bg-white shadow-sm">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                {f.reactionType ? <Badge variant="secondary">{f.reactionType}</Badge> : null}
                                {typeof f.rating === 'number' ? <Badge variant="outline">Rating: {f.rating}</Badge> : null}
                                {f.isAnonymous ? <Badge variant="outline">Anonymous</Badge> : null}
                              </div>
                              <div className="mt-2 text-sm text-slate-800">
                                {f.comment ? f.comment : <span className="text-muted-foreground">No comment</span>}
                              </div>
                              {!f.isAnonymous && f.user?.fullName ? (
                                <div className="mt-2 text-xs text-muted-foreground">By {f.user.fullName}</div>
                              ) : null}
                            </div>
                            <div className="text-xs text-muted-foreground">{formatRelativeDays(f.createdAt)}</div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Card className="rounded-2xl bg-white border-primary/20 shadow-md">
                <CardHeader>
                  <CardTitle>Leave feedback</CardTitle>
                  <CardDescription>Share your reaction or comment.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Reaction</Label>
                    <Select value={reactionType} onValueChange={setReactionType}>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Select reaction" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="positive">positive</SelectItem>
                        <SelectItem value="neutral">neutral</SelectItem>
                        <SelectItem value="negative">negative</SelectItem>
                        <SelectItem value="question">question</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Rating (optional)</Label>
                    <Input
                      className="bg-white"
                      inputMode="numeric"
                      placeholder="1 - 5"
                      value={rating}
                      onChange={(e) => {
                        setRating(e.target.value)
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Comment (optional)</Label>
                    <Textarea
                      className="min-h-24 bg-white"
                      placeholder="Write your feedback..."
                      value={comment}
                      onChange={(e) => {
                        setComment(e.target.value)
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border bg-slate-50 p-3">
                    <div>
                      <div className="text-sm font-medium">Post anonymously</div>
                      <div className="text-xs text-muted-foreground">Hide your identity from the list</div>
                    </div>
                    <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
                  </div>

                  <Button
                    type="button"
                    className="w-full rounded-full"
                    disabled={isSubmittingFeedback || isLoadingFeedback}
                    onClick={() => {
                      async function submit() {
                        setFeedbackError(null)

                        const parsedRating = rating.trim() ? Number(rating) : null
                        const safeRating =
                          parsedRating === null || Number.isNaN(parsedRating)
                            ? null
                            : Math.min(5, Math.max(1, Math.floor(parsedRating)))

                        setIsSubmittingFeedback(true)
                        try {
                          await createFeedback({
                            announcementId,
                            reactionType,
                            comment: comment.trim() ? comment.trim() : null,
                            rating: safeRating,
                            isAnonymous,
                          })

                          const res = await listFeedbackForAnnouncement(announcementId, { limit: 50, offset: 0 })
                          setFeedbackItems(Array.isArray(res.feedback) ? res.feedback : [])
                          setComment('')
                          setRating('')
                          setIsAnonymous(false)
                        } catch (err) {
                          if (err instanceof ApiError) setFeedbackError(err.message)
                          else if (err instanceof Error) setFeedbackError(err.message)
                          else setFeedbackError('Failed to submit feedback.')
                        } finally {
                          setIsSubmittingFeedback(false)
                        }
                      }

                      submit()
                    }}
                  >
                    {isSubmittingFeedback ? 'Submitting...' : 'Submit feedback'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <HomeFooter />
    </div>
  )
}
