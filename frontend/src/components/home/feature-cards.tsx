import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartColumn, Megaphone, MessagesSquare, Target } from 'lucide-react'

export function FeatureCards() {
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="rounded-xl bg-white">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <Megaphone className="size-4 text-primary" />
            <CardTitle className="text-sm">Real-time Notifications</CardTitle>
          </div>
          <CardDescription className="text-xs">Get instant updates on important events and announcements.</CardDescription>
        </CardHeader>
      </Card>

      <Card className="rounded-xl bg-white">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <MessagesSquare className="size-4 text-primary" />
            <CardTitle className="text-sm">Feedback System</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Share your thoughts and reactions to announcements anonymously or publicly.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="rounded-xl bg-white">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <Target className="size-4 text-primary" />
            <CardTitle className="text-sm">Targeted Communication</CardTitle>
          </div>
          <CardDescription className="text-xs">Receive announcements relevant to your department and year.</CardDescription>
        </CardHeader>
      </Card>

      <Card className="rounded-xl bg-white">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <ChartColumn className="size-4 text-primary" />
            <CardTitle className="text-sm">Analytics Dashboard</CardTitle>
          </div>
          <CardDescription className="text-xs">Track engagement and reach with detailed analytics.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
