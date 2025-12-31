import { useEffect, useMemo, useState } from 'react'

import { FeatureCards } from '@/components/home/feature-cards'
import { HomeFooter } from '@/components/home/home-footer'
import { HeroSection } from '@/components/home/hero-section'
import { RecentAnnouncements } from '@/components/home/recent-announcements'
import { AppHeader } from '@/components/layout/app-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Announcement } from '@/lib/announcements-api'
import { listAnnouncements } from '@/lib/announcements-api'
import { ApiError } from '@/lib/api-error'

export function HomePage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState(true)
  const [announcementsError, setAnnouncementsError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      setIsLoadingAnnouncements(true)
      setAnnouncementsError(null)
      try {
        const list = await listAnnouncements()
        if (cancelled) return
        setAnnouncements(list)
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError) setAnnouncementsError(err.message)
        else if (err instanceof Error) setAnnouncementsError(err.message)
        else setAnnouncementsError('Failed to load announcements.')
      } finally {
        if (!cancelled) setIsLoadingAnnouncements(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [])

  const recentAnnouncements = useMemo(() => {
    return [...announcements]
      .filter((a) => a.status === 'published')
      .sort((a, b) => {
        const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : a.createdAt ? new Date(a.createdAt).getTime() : 0
        const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : b.createdAt ? new Date(b.createdAt).getTime() : 0
        return tb - ta
      })
  }, [announcements])

  return (
    <div className="min-h-screen bg-slate-100 text-foreground">
      <AppHeader />

      <main>
        <section className="mx-auto max-w-4xl px-4 pb-8 pt-4">
          <HeroSection />
          <FeatureCards />
          {isLoadingAnnouncements ? (
            <Card className="mt-10 rounded-2xl bg-white border-primary/20 shadow-md">
              <CardHeader>
                <CardTitle>Loading announcements...</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">Please wait.</CardContent>
            </Card>
          ) : announcementsError ? (
            <Card className="mt-10 rounded-2xl bg-white border-primary/20 shadow-md">
              <CardHeader>
                <CardTitle>Could not load announcements</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-destructive">{announcementsError}</CardContent>
            </Card>
          ) : (
            <RecentAnnouncements announcements={recentAnnouncements} />
          )}
        </section>

        {/* <section className="border-t bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-14 text-center">
            <h3 className="text-2xl font-semibold">Ready to stay connected?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Join thousands of students and faculty already using CDCP to stay informed and engaged with campus
              life.
            </p>
            <div className="mt-6">
              <Button className="rounded-full">Create Your Account</Button>
            </div>
          </div>
        </section> */}
      </main>

      <HomeFooter />
    </div>
  )
}
