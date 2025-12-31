import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { HomeFooter } from '@/components/home/home-footer'
import { AppHeader } from '@/components/layout/app-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ApiError } from '@/lib/api-error'
import type { Announcement } from '@/lib/announcements-api'
import { getAnnouncement } from '@/lib/announcements-api'
import type { Notification } from '@/lib/notifications-api'
import { listNotifications, markNotificationRead } from '@/lib/notifications-api'

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

function toSnippet(value?: string | null, max = 140) {
  const v = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  if (!v) return '—'
  if (v.length <= max) return v
  return `${v.slice(0, max)}…`
}

export function NotificationsPage() {
  const navigate = useNavigate()

  const [items, setItems] = useState<Notification[]>([])
  const [announcementById, setAnnouncementById] = useState<Record<string, Announcement>>({})
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      setIsLoading(true)
      setError(null)
      try {
        const res = await listNotifications({ limit: 50, offset: 0 })
        if (cancelled) return
        const list = Array.isArray(res.notifications) ? res.notifications : []
        setItems(list)

        const neededAnnouncementIds = Array.from(new Set(list.map((n) => n.announcementId)))
        await Promise.all(
          neededAnnouncementIds
            .filter((id) => !announcementById[id])
            .map(async (id) => {
              try {
                const a = await getAnnouncement(id)
                if (cancelled) return
                setAnnouncementById((prev) => ({ ...prev, [id]: a }))
              } catch {
                // ignore
              }
            })
        )
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError) setError(err.message)
        else if (err instanceof Error) setError(err.message)
        else setError('Failed to load notifications.')
        setItems([])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [])

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
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Click an item to mark it as read and open the related announcement.</CardDescription>
            </CardHeader>
            <CardContent>
              {error ? <div className="text-sm text-destructive">{error}</div> : null}

              {isLoading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : items.length === 0 ? (
                <div className="text-sm text-muted-foreground">No notifications.</div>
              ) : (
                <ScrollArea className="h-[28rem]">
                  <div className="space-y-3 pr-3">
                    {items.map((n) => {
                      const isUnread = !n.readAt
                      const announcement = announcementById[n.announcementId]
                      return (
                        <Card
                          key={n.id}
                          className="rounded-xl bg-white shadow-sm transition-shadow hover:shadow-md"
                        >
                          <CardContent className="p-4">
                            <button
                              type="button"
                              className="w-full text-left"
                              onClick={() => {
                                async function run() {
                                  setItems((prev) =>
                                    prev.map((x) => (x.id === n.id ? { ...x, readAt: x.readAt ?? new Date().toISOString() } : x))
                                  )
                                  try {
                                    if (isUnread) await markNotificationRead(n.id)
                                  } finally {
                                    navigate(`/announcements/${n.announcementId}`)
                                  }
                                }

                                run()
                              }}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-medium">{announcement?.title ?? 'Announcement update'}</span>
                                    {isUnread ? <Badge>Unread</Badge> : <Badge variant="outline">Read</Badge>}
                                  </div>
                                  <div className="mt-2 text-xs text-muted-foreground">{toSnippet(announcement?.content)}</div>
                                </div>
                                <div className="text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</div>
                              </div>
                            </button>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <HomeFooter />
    </div>
  )
}
