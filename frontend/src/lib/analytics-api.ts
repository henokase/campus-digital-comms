import { requestJson } from '@/lib/api-client'

export type AnalyticsDashboard = {
  totalAnnouncements: number
  totalNotificationsSent: number
  totalNotificationsRead: number
  totalFeedbackCount: number
}

export type AnnouncementMetrics = {
  announcementId: string
  notificationsSent: number
  notificationsRead: number
  feedbackCount: number
  lastUpdatedAt?: string | null
}

export type GetAnnouncementMetricsResponse = {
  metrics: AnnouncementMetrics
}

export type TopAnnouncement = {
  announcementId: string
  feedbackCount: number
}

export type GetTopAnnouncementsResponse = {
  announcements: TopAnnouncement[]
  limit: number
}

export async function getAnalyticsDashboard(): Promise<AnalyticsDashboard> {
  return requestJson<AnalyticsDashboard>('/api/analytics/dashboard', { method: 'GET' }, { auth: 'required' })
}

export async function getAnnouncementMetrics(announcementId: string): Promise<AnnouncementMetrics> {
  const res = await requestJson<GetAnnouncementMetricsResponse>(`/api/analytics/announcement/${announcementId}`, { method: 'GET' }, { auth: 'required' })
  return res.metrics
}

export async function getTopAnnouncements(params?: { limit?: number }): Promise<GetTopAnnouncementsResponse> {
  const qs = new URLSearchParams()
  if (typeof params?.limit === 'number') qs.set('limit', String(params.limit))
  const query = qs.toString()
  return requestJson<GetTopAnnouncementsResponse>(`/api/analytics/top-announcements${query ? `?${query}` : ''}`,
    { method: 'GET' },
    { auth: 'required' },
  )
}
