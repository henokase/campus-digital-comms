import logo from '@/assets/logo.png'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Menubar } from '@/components/ui/menubar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuth } from '@/hooks/use-auth'
import type { Announcement } from '@/lib/announcements-api'
import { getAnnouncement } from '@/lib/announcements-api'
import type { Notification } from '@/lib/notifications-api'
import { getUnreadCount, listNotifications, markNotificationRead } from '@/lib/notifications-api'
import { NOTIFICATIONS_CHANGED_EVENT } from '@/lib/notifications-events'
import type { Feedback } from '@/lib/feedback-api'
import { listMyFeedback } from '@/lib/feedback-api'
import { FEEDBACK_CHANGED_EVENT } from '@/lib/feedback-events'
import { Bell, ChevronDown } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

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

function getInitials(name?: string | null) {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const a = parts[0]?.[0] ?? 'U'
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
  return (a + b).toUpperCase()
}

function toSnippet(value?: string | null, max = 90) {
  const v = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  if (!v) return '—'
  if (v.length <= max) return v
  return `${v.slice(0, max)}…`
}

export function AppHeader() {
  const { isAuthenticated, user, logout } = useAuth()
  const navigate = useNavigate()

  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [recentUnread, setRecentUnread] = useState<Notification[]>([])
  const [announcementById, setAnnouncementById] = useState<Record<string, Announcement>>({})
  const [isLoadingNotifications, setIsLoadingNotifications] = useState<boolean>(false)
  const [notificationsError, setNotificationsError] = useState<string | null>(null)

  const [myFeedback, setMyFeedback] = useState<Feedback[]>([])
  const [isLoadingMyFeedback, setIsLoadingMyFeedback] = useState<boolean>(false)
  const [myFeedbackError, setMyFeedbackError] = useState<string | null>(null)

  const shouldLoadNotifications = isAuthenticated && Boolean(user)

  async function refreshNotifications() {
    if (!shouldLoadNotifications) return

    setIsLoadingNotifications(true)
    setNotificationsError(null)
    try {
      const [count, list] = await Promise.all([
        getUnreadCount(),
        listNotifications({ limit: 20, offset: 0 }),
      ])

      setUnreadCount(count)

      const unread = (Array.isArray(list.notifications) ? list.notifications : []).filter((n) => !n.readAt)
      setRecentUnread(unread.slice(0, 6))

      const neededAnnouncementIds = Array.from(new Set(unread.slice(0, 6).map((n) => n.announcementId)))
      await Promise.all(
        neededAnnouncementIds
          .filter((id) => !announcementById[id])
          .map(async (id) => {
            try {
              const a = await getAnnouncement(id)
              setAnnouncementById((prev) => ({ ...prev, [id]: a }))
            } catch {
              // ignore
            }
          })
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load notifications.'
      setNotificationsError(message)
      setUnreadCount(0)
      setRecentUnread([])
    } finally {
      setIsLoadingNotifications(false)
    }
  }

  async function refreshMyFeedback() {
    if (!shouldLoadNotifications) return

    setIsLoadingMyFeedback(true)
    setMyFeedbackError(null)
    try {
      const res = await listMyFeedback({ limit: 8, offset: 0 })
      setMyFeedback(Array.isArray(res.feedback) ? res.feedback : [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load feedback.'
      setMyFeedbackError(message)
      setMyFeedback([])
    } finally {
      setIsLoadingMyFeedback(false)
    }
  }

  useEffect(() => {
    if (!shouldLoadNotifications) {
      setUnreadCount(0)
      setRecentUnread([])
      setMyFeedback([])
      return
    }

    refreshNotifications()
    refreshMyFeedback()
  }, [shouldLoadNotifications])

  useEffect(() => {
    if (!shouldLoadNotifications) return

    function onChanged() {
      refreshNotifications()
    }

    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged)
    return () => {
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged)
    }
  }, [shouldLoadNotifications])

  useEffect(() => {
    if (!shouldLoadNotifications) return

    function onFeedbackChanged() {
      refreshMyFeedback()
    }

    window.addEventListener(FEEDBACK_CHANGED_EVENT, onFeedbackChanged)
    return () => {
      window.removeEventListener(FEEDBACK_CHANGED_EVENT, onFeedbackChanged)
    }
  }, [shouldLoadNotifications])

  const displayName = user?.fullName ?? null
  const displayEmail = user?.email ?? ''
  const avatarLabel = displayName ?? displayEmail

  const hasUnreadNotifications = useMemo(() => unreadCount > 0, [unreadCount])

  return (
    <div className="bg-slate-100">
      <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4">
        <Menubar className="h-12 w-full rounded-full px-3 shadow-none">
          <div className="flex items-center gap-2">
            <img src={logo} alt="CDCP" className="h-7 w-7" />
            <div className="leading-tight" />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button asChild type="button" variant="ghost" className="h-9 rounded-full px-4">
              <Link to="/">Home</Link>
            </Button>

            <div className="mx-1 h-5 w-px bg-border" />

            {isAuthenticated ? (
              <>
                <DropdownMenu
                  onOpenChange={(open) => {
                    if (open) refreshNotifications()
                  }}
                >
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" className="relative h-9 rounded-full px-3">
                      <div className="relative flex items-center">
                        <Bell className="size-4" />
                        {hasUnreadNotifications ? (
                          <Badge className="absolute -right-2 -top-2 h-4 min-w-4 justify-center px-1" variant="default">
                            {unreadCount}
                          </Badge>
                        ) : null}
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-96">
                    <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <ScrollArea className="h-56">
                      {notificationsError ? (
                        <div className="px-2 py-3 text-sm text-destructive">{notificationsError}</div>
                      ) : isLoadingNotifications ? (
                        <div className="px-2 py-3 text-sm text-muted-foreground">Loading...</div>
                      ) : recentUnread.length === 0 ? (
                        <div className="px-2 py-3 text-sm text-muted-foreground">No unread notifications.</div>
                      ) : (
                        recentUnread.map((n) => (
                          <DropdownMenuItem
                            key={n.id}
                            className="flex flex-col items-start gap-1"
                            onSelect={(e) => {
                              e.preventDefault()
                              async function run() {
                                setUnreadCount((c) => Math.max(0, c - 1))
                                setRecentUnread((prev) => prev.filter((x) => x.id !== n.id))
                                try {
                                  await markNotificationRead(n.id)
                                } finally {
                                  navigate(`/announcements/${n.announcementId}`)
                                }
                              }

                              run()
                            }}
                          >
                            <div className="flex w-full items-center justify-between">
                              <span className="text-sm font-medium">{announcementById[n.announcementId]?.title ?? 'Announcement update'}</span>
                              <span className="text-xs text-muted-foreground">{formatRelativeDays(n.createdAt)}</span>
                            </div>
                            <div className="line-clamp-2 text-xs text-muted-foreground">
                              {toSnippet(announcementById[n.announcementId]?.content)}
                            </div>
                          </DropdownMenuItem>
                        ))
                      )}
                    </ScrollArea>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault()
                        navigate('/notifications')
                      }}
                      className="font-medium"
                    >
                      View all notifications
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu
                  onOpenChange={(open) => {
                    if (open) refreshMyFeedback()
                  }}
                >
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-9 rounded-full px-2">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src="" alt={avatarLabel} />
                        <AvatarFallback>{getInitials(avatarLabel)}</AvatarFallback>
                      </Avatar>
                      <span className="ml-2 hidden text-sm font-medium sm:inline">
                        {displayName ? displayName : user ? displayEmail : 'Loading...'}
                      </span>
                      <ChevronDown className="ml-1 size-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80">
                    <DropdownMenuLabel>My Feedbacks</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <ScrollArea className="h-56">
                      {myFeedbackError ? (
                        <div className="px-2 py-3 text-sm text-destructive">{myFeedbackError}</div>
                      ) : isLoadingMyFeedback ? (
                        <div className="px-2 py-3 text-sm text-muted-foreground">Loading...</div>
                      ) : myFeedback.length === 0 ? (
                        <div className="px-2 py-3 text-sm text-muted-foreground">
                          You have not submitted feedback yet.
                        </div>
                      ) : (
                        myFeedback.slice(0, 8).map((f) => (
                          <DropdownMenuItem
                            key={f.id}
                            className="flex flex-col items-start gap-1"
                            onSelect={(e) => {
                              e.preventDefault()
                            }}
                          >
                            <div className="flex w-full items-center justify-between">
                              <span className="text-sm font-medium">{f.reactionType ? f.reactionType : 'Feedback'}</span>
                              <span className="text-xs text-muted-foreground">{formatRelativeDays(f.createdAt)}</span>
                            </div>
                            <div className="line-clamp-2 text-xs text-muted-foreground">
                              {f.comment ? f.comment : 'No comment'}
                            </div>
                          </DropdownMenuItem>
                        ))
                      )}
                    </ScrollArea>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault()
                        logout()
                      }}
                      className="text-destructive"
                    >
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button asChild type="button" variant="ghost" className="h-9 rounded-full px-4">
                  <Link to="/login">Log in</Link>
                </Button>
                <Button asChild type="button" className="h-9 rounded-full px-4">
                  <Link to="/signup">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </Menubar>
      </div>
    </div>
  )
}
