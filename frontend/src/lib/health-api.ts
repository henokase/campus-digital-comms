import { requestJson } from '@/lib/api-client'

export type HealthResponse = {
  status: string
  service?: string
}

export function getHealth() {
  return requestJson<HealthResponse>('/health', { method: 'GET' }, { auth: 'none' })
}
