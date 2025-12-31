export type BackendErrorEnvelope = {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export class ApiError extends Error {
  status: number
  code: string
  details?: unknown

  constructor(args: { status: number; code: string; message: string; details?: unknown }) {
    super(args.message)
    this.name = 'ApiError'
    this.status = args.status
    this.code = args.code
    this.details = args.details
  }
}

export function isBackendErrorEnvelope(v: unknown): v is BackendErrorEnvelope {
  if (!v || typeof v !== 'object') return false
  const obj = v as any
  if (!obj.error || typeof obj.error !== 'object') return false
  if (typeof obj.error.code !== 'string') return false
  if (typeof obj.error.message !== 'string') return false
  return true
}
