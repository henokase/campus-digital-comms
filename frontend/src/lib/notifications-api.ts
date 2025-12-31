import { requestJson } from '@/lib/api-client'
import { emitNotificationsChanged } from '@/lib/notifications-events'

export type Notification = {
  id: string
  announcementId: string
  userId: string
  channel?: string | null
  sourceEventId?: string | null
  status?: string | null
  sentAt?: string | null
  readAt?: string | null
  errorMessage?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type ListNotificationsResponse = {
  notifications: Notification[]
  limit: number
  offset: number
}

export type UnreadCountResponse = {
  count: number
}

export type MarkReadResponse = {
  notification: Notification
}

export async function listNotifications(params?: { limit?: number; offset?: number }): Promise<ListNotificationsResponse> {
  const qs = new URLSearchParams()
  if (typeof params?.limit === 'number') qs.set('limit', String(params.limit))
  if (typeof params?.offset === 'number') qs.set('offset', String(params.offset))
  const query = qs.toString()

  return requestJson<ListNotificationsResponse>(
    `/api/notifications${query ? `?${query}` : ''}`,
    { method: 'GET' },
    { auth: 'required' },
  )
}

export async function getUnreadCount(): Promise<number> {
  const res = await requestJson<UnreadCountResponse>('/api/notifications/unread-count', { method: 'GET' }, { auth: 'required' })
  return typeof res.count === 'number' ? res.count : 0
}

export async function markNotificationRead(notificationId: string): Promise<Notification> {
  const res = await requestJson<MarkReadResponse>(
    `/api/notifications/${notificationId}/read`,
    { method: 'PUT' },
    { auth: 'required' },
  )
  emitNotificationsChanged()
  return res.notification
}
