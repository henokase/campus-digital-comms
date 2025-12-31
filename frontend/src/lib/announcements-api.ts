import { requestJson } from '@/lib/api-client'

export type AnnouncementTargetAudience = {
  roles?: string[]
  departments?: string[]
  years?: number[]
  [key: string]: unknown
}

export type Announcement = {
  id: string
  title: string
  content: string
  type: string
  category?: string | null
  priority?: string | null
  createdBy?: string | null
  targetAudience?: AnnouncementTargetAudience | null
  status?: string | null
  publishedAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type ListAnnouncementsResponse = {
  announcements: Announcement[]
}

export type GetAnnouncementResponse = {
  announcement: Announcement
}

export type CreateAnnouncementRequest = {
  title: string
  content: string
  type: string
  category?: string | null
  priority: string
  targetAudience: AnnouncementTargetAudience
}

export type UpdateAnnouncementRequest = CreateAnnouncementRequest

export type AnnouncementEnvelope = {
  announcement: Announcement
}

export async function listAnnouncements(): Promise<Announcement[]> {
  const res = await requestJson<ListAnnouncementsResponse>('/api/announcements', { method: 'GET' })
  return Array.isArray(res.announcements) ? res.announcements : []
}

export async function getAnnouncement(id: string): Promise<Announcement> {
  const res = await requestJson<GetAnnouncementResponse>(`/api/announcements/${id}`, { method: 'GET' })
  return res.announcement
}

export async function createAnnouncement(payload: CreateAnnouncementRequest): Promise<Announcement> {
  const res = await requestJson<AnnouncementEnvelope>(
    '/api/announcements',
    {
      method: 'POST',
      body: {
        title: payload.title,
        content: payload.content,
        type: payload.type,
        category: payload.category ?? null,
        priority: payload.priority,
        targetAudience: payload.targetAudience,
      },
    },
    { auth: 'required' },
  )
  return res.announcement
}

export async function updateAnnouncement(id: string, payload: UpdateAnnouncementRequest): Promise<Announcement> {
  const res = await requestJson<AnnouncementEnvelope>(
    `/api/announcements/${id}`,
    {
      method: 'PUT',
      body: {
        title: payload.title,
        content: payload.content,
        type: payload.type,
        category: payload.category ?? null,
        priority: payload.priority,
        targetAudience: payload.targetAudience,
      },
    },
    { auth: 'required' },
  )
  return res.announcement
}

export async function deleteAnnouncement(id: string): Promise<Announcement> {
  const res = await requestJson<AnnouncementEnvelope>(`/api/announcements/${id}`, { method: 'DELETE' }, { auth: 'required' })
  return res.announcement
}

export async function publishAnnouncement(id: string): Promise<Announcement> {
  const res = await requestJson<AnnouncementEnvelope>(
    `/api/announcements/${id}/publish`,
    { method: 'POST' },
    { auth: 'required' },
  )
  return res.announcement
}
