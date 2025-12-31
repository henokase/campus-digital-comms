export const DEFAULT_API_GATEWAY_URL = 'http://localhost:3000'

export function getApiGatewayUrl(): string {
  const env = (import.meta as any)?.env as Record<string, unknown> | undefined
  const raw = (env?.VITE_API_GATEWAY_URL as string | undefined) ?? (env?.API_GATEWAY_URL as string | undefined)
  const base = (raw && raw.trim().length > 0 ? raw.trim() : DEFAULT_API_GATEWAY_URL).replace(/\/+$/, '')
  return base
}
