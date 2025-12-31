import { getApiGatewayUrl } from '@/lib/api-config'
import { ApiError, isBackendErrorEnvelope } from '@/lib/api-error'

const TOKEN_STORAGE_KEY = 'cdcp.token'

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

export function setStoredToken(token: string | null) {
  try {
    if (!token) {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
      return
    }
    localStorage.setItem(TOKEN_STORAGE_KEY, token)
  } catch {
    // ignore
  }
}

function joinUrl(base: string, path: string) {
  if (/^https?:\/\//i.test(path)) return path
  if (path.startsWith('/')) return `${base}${path}`
  return `${base}/${path}`
}

async function readResponseBody(res: Response): Promise<unknown> {
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    try {
      return await res.json()
    } catch {
      return null
    }
  }

  try {
    return await res.text()
  } catch {
    return null
  }
}

export type RequestJsonOptions = {
  baseUrl?: string
  auth?: 'auto' | 'none' | 'required'
}

export type JsonRequestInit = Omit<RequestInit, 'body'> & {
  body?: unknown
}

export async function requestJson<T>(path: string, init: JsonRequestInit = {}, options: RequestJsonOptions = {}): Promise<T> {
  const baseUrl = (options.baseUrl ?? getApiGatewayUrl()).replace(/\/+$/, '')
  const url = joinUrl(baseUrl, path)

  const { body: reqBody, ...restInit } = init

  const headers = new Headers(restInit.headers)
  if (!headers.has('accept')) headers.set('accept', 'application/json')

  const authMode = options.auth ?? 'auto'
  if (authMode !== 'none') {
    const token = getStoredToken()
    if (token) {
      headers.set('authorization', `Bearer ${token}`)
    } else if (authMode === 'required') {
      throw new ApiError({ status: 401, code: 'UNAUTHORIZED', message: 'Missing authentication token.' })
    }
  }

  const requestInit: RequestInit = {
    ...restInit,
    headers,
  }

  if (reqBody !== undefined && reqBody !== null) {
    if (reqBody instanceof FormData) {
      requestInit.body = reqBody
    } else if (reqBody instanceof Blob) {
      requestInit.body = reqBody
    } else if (reqBody instanceof ArrayBuffer) {
      requestInit.body = reqBody
    } else if (reqBody instanceof URLSearchParams) {
      requestInit.body = reqBody
    } else if (typeof reqBody === 'string') {
      if (!headers.has('content-type')) headers.set('content-type', 'application/json')
      requestInit.body = reqBody
    } else if (typeof reqBody === 'object') {
      if (!headers.has('content-type')) headers.set('content-type', 'application/json')
      requestInit.body = JSON.stringify(reqBody)
    }
  }

  let res: Response
  try {
    res = await fetch(url, requestInit)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error'
    throw new ApiError({ status: 0, code: 'NETWORK_ERROR', message, details: { url } })
  }

  if (res.ok) {
    const body = await readResponseBody(res)
    return body as T
  }

  const body = await readResponseBody(res)
  if (isBackendErrorEnvelope(body)) {
    throw new ApiError({ status: res.status, code: body.error.code, message: body.error.message, details: body.error.details })
  }

  const message = typeof body === 'string' && body.trim().length > 0 ? body : `Request failed with status ${res.status}`
  throw new ApiError({ status: res.status, code: 'HTTP_ERROR', message, details: body })
}
