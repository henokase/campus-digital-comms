import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { Announcement } from '@/lib/announcements-api'
import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'

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

export function RecentAnnouncements({ announcements }: { announcements: Announcement[] }) {
  const [visibleCount, setVisibleCount] = useState(3)

  const visibleAnnouncements = useMemo(() => {
    return announcements.slice(0, Math.min(visibleCount, announcements.length))
  }, [announcements, visibleCount])

  const canLoadMore = visibleCount < announcements.length

  const showMoreLabel = canLoadMore ? 'Show more' : ''

  return (
    <div className="mt-10 text-center">
      <h2 className="text-xl font-semibold">Announcements</h2>
      <p className="mt-1 text-sm text-muted-foreground">Stay up to date with the latest campus updates</p>

      <div className="mx-auto mt-6 max-w-3xl space-y-4">
        {visibleAnnouncements.map((a) => {
          const isHigh = a.priority === 'high'
          const snippet = (a.content ?? '').replace(/\s+/g, ' ').trim().slice(0, 120)
          return (
            <Link key={a.id} to={`/announcements/${a.id}`} className="block">
              <Card className="rounded-2xl border-primary/20 bg-white shadow-md transition-shadow hover:shadow-lg">
                <CardContent className="p-6">
                  <div className="min-w-0 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{a.category ?? 'General'}</Badge>
                      {isHigh ? <Badge>High Priority</Badge> : null}
                    </div>

                    <div className="mt-3 text-lg font-bold leading-tight">{a.title}</div>
                    <div className="mt-2 text-sm font-bold text-left text-muted-foreground">{formatRelativeDays(a.publishedAt)}</div>
                    {snippet ? (
                      <div className="mt-3 text-sm text-muted-foreground">
                        {snippet}
                        {a.content && a.content.length > 120 ? '…' : ''}
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {canLoadMore ? (
        <div className="mt-6">
          <Button
            type="button"
            variant="outline"
            className="rounded-full bg-white"
            onClick={() => {
              setVisibleCount((c) => Math.min(announcements.length, c + 3))
            }}
          >
            {showMoreLabel}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
