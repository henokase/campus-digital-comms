import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/hooks/use-auth'
import { ApiError } from '@/lib/api-error'
import type { Announcement } from '@/lib/announcements-api'
import { deleteAnnouncement, listAnnouncements } from '@/lib/announcements-api'
import type { AnnouncementMetrics, AnalyticsDashboard } from '@/lib/analytics-api'
import { getAnalyticsDashboard, getAnnouncementMetrics } from '@/lib/analytics-api'

type RowItem = {
  announcement: Announcement
  metrics: AnnouncementMetrics | null
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { logout } = useAuth()

  const [dashboard, setDashboard] = useState<AnalyticsDashboard | null>(null)
  const [items, setItems] = useState<Announcement[]>([])
  const [metricsById, setMetricsById] = useState<Record<string, AnnouncementMetrics>>({})

  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      setIsLoading(true)
      setError(null)
      try {
        const [dash, list] = await Promise.all([getAnalyticsDashboard(), listAnnouncements()])
        if (cancelled) return

        setDashboard(dash)
        setItems(Array.isArray(list) ? list : [])

        const metricsResults = await Promise.all(
          (Array.isArray(list) ? list : []).map(async (a) => {
            try {
              const m = await getAnnouncementMetrics(a.id)
              return [a.id, m] as const
            } catch {
              return null
            }
          }),
        )

        if (cancelled) return

        const next: Record<string, AnnouncementMetrics> = {}
        for (const r of metricsResults) {
          if (!r) continue
          next[r[0]] = r[1]
        }
        setMetricsById(next)
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError) setError(err.message)
        else if (err instanceof Error) setError(err.message)
        else setError('Failed to load dashboard data.')
        setDashboard(null)
        setItems([])
        setMetricsById({})
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [])

  const rows: RowItem[] = useMemo(() => {
    return items
      .slice()
      .sort((a, b) => {
        const av = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime()
        const bv = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime()
        return bv - av
      })
      .map((a) => ({ announcement: a, metrics: metricsById[a.id] ?? null }))
  }, [items, metricsById])

  return (
    <div className="min-h-screen bg-slate-50 text-foreground">
      <header className="sticky top-0 z-10 border-b border-purple-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <div>
            <div className="text-sm font-semibold text-purple-700">Admin Dashboard</div>
            <div className="text-xs text-muted-foreground">Manage announcements and view engagement metrics.</div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild className="rounded-full bg-purple-600 text-white hover:bg-purple-700">
              <Link to="/dashboard/announcements/new">Create announcement</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-purple-200 text-purple-700 hover:bg-purple-50"
              onClick={() => {
                logout()
                navigate('/login')
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        {error ? <div className="text-sm text-destructive">{error}</div> : null}

        <Card className="border-purple-100">
          <CardHeader>
            <CardTitle className="text-purple-700">Overview</CardTitle>
            <CardDescription>Platform-wide engagement summary for faculty/admin.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : dashboard ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-purple-100 p-3">
                  <div className="text-xs text-muted-foreground">Total announcements</div>
                  <div className="text-xl font-semibold">{dashboard.totalAnnouncements}</div>
                </div>
                <div className="rounded-lg border border-purple-100 p-3">
                  <div className="text-xs text-muted-foreground">Notifications sent</div>
                  <div className="text-xl font-semibold">{dashboard.totalNotificationsSent}</div>
                </div>
                <div className="rounded-lg border border-purple-100 p-3">
                  <div className="text-xs text-muted-foreground">Notifications read</div>
                  <div className="text-xl font-semibold">{dashboard.totalNotificationsRead}</div>
                </div>
                <div className="rounded-lg border border-purple-100 p-3">
                  <div className="text-xs text-muted-foreground">Feedback count</div>
                  <div className="text-xl font-semibold">{dashboard.totalFeedbackCount}</div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No dashboard analytics.</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-purple-100">
          <CardHeader>
            <CardTitle className="text-purple-700">Announcements</CardTitle>
            <CardDescription>Edit and delete announcements. Analytics refresh automatically.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : rows.length === 0 ? (
              <div className="text-sm text-muted-foreground">No announcements.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead className="whitespace-nowrap">Notifications sent</TableHead>
                    <TableHead className="whitespace-nowrap">Notifications read</TableHead>
                    <TableHead className="whitespace-nowrap">Feedback</TableHead>
                    <TableHead></TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ announcement: a, metrics }) => (
                    <TableRow key={a.id}>
                      <TableCell className="max-w-[28rem]">
                        <div className="truncate font-medium">{a.title}</div>
                        <div className="truncate text-xs text-muted-foreground">{a.category ?? 'General'}</div>
                      </TableCell>
                      <TableCell>{metrics ? metrics.notificationsSent : '—'}</TableCell>
                      <TableCell>{metrics ? metrics.notificationsRead : '—'}</TableCell>
                      <TableCell>{metrics ? metrics.feedbackCount : '—'}</TableCell>
                      <TableCell>{formatDate(a.updatedAt ?? a.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full border-purple-200 text-purple-700 hover:bg-purple-50"
                            onClick={() => navigate(`/dashboard/announcements/${a.id}/edit`)}
                          >
                            Edit
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="destructive" className="rounded-full">
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete announcement?</AlertDialogTitle>
                                <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={async () => {
                                    const before = items
                                    setItems((prev) => prev.filter((x) => x.id !== a.id))
                                    try {
                                      await deleteAnnouncement(a.id)
                                    } catch (err) {
                                      const message = err instanceof Error ? err.message : 'Failed to delete.'
                                      setError(message)
                                      setItems(before)
                                    }
                                  }}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
