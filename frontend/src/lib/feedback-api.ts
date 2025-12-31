import { requestJson } from '@/lib/api-client'
import { emitFeedbackChanged } from '@/lib/feedback-events'

export type FeedbackUser = {
  id: string
  fullName?: string | null
  email?: string | null
  role?: string | null
  department?: string | null
  year?: number | null
}

export type Feedback = {
  id: string
  announcementId: string
  userId?: string | null
  reactionType?: string | null
  comment?: string | null
  rating?: number | null
  isAnonymous: boolean
  createdAt?: string | null
  updatedAt?: string | null
  user?: FeedbackUser | null
}

export type CreateFeedbackRequest = {
  announcementId: string
  reactionType: string
  comment?: string | null
  rating?: number | null
  isAnonymous?: boolean | null
}

export type ListAnnouncementFeedbackResponse = {
  feedback: Feedback[]
  limit: number
  offset: number
}

export type ListMyFeedbackResponse = {
  feedback: Feedback[]
  limit: number
  offset: number
}

export type CreateFeedbackResponse = {
  feedback: Feedback
}

export async function listFeedbackForAnnouncement(announcementId: string, params?: { limit?: number; offset?: number }): Promise<ListAnnouncementFeedbackResponse> {
  const qs = new URLSearchParams()
  if (typeof params?.limit === 'number') qs.set('limit', String(params.limit))
  if (typeof params?.offset === 'number') qs.set('offset', String(params.offset))

  const query = qs.toString()
  return requestJson<ListAnnouncementFeedbackResponse>(
    `/api/feedback/announcement/${announcementId}${query ? `?${query}` : ''}`,
    { method: 'GET' },
    { auth: 'required' },
  )
}

export async function createFeedback(payload: CreateFeedbackRequest): Promise<Feedback> {
  const res = await requestJson<CreateFeedbackResponse>(
    '/api/feedback',
    {
      method: 'POST',
      body: {
        announcementId: payload.announcementId,
        reactionType: payload.reactionType,
        comment: payload.comment ?? null,
        rating: payload.rating ?? null,
        isAnonymous: payload.isAnonymous ?? false,
      },
    },
    { auth: 'required' },
  )
  emitFeedbackChanged()
  return res.feedback
}

export async function listMyFeedback(params?: { limit?: number; offset?: number }): Promise<ListMyFeedbackResponse> {
  const qs = new URLSearchParams()
  if (typeof params?.limit === 'number') qs.set('limit', String(params.limit))
  if (typeof params?.offset === 'number') qs.set('offset', String(params.offset))

  const query = qs.toString()
  return requestJson<ListMyFeedbackResponse>(
    `/api/feedback/my${query ? `?${query}` : ''}`,
    { method: 'GET' },
    { auth: 'required' },
  )
}
