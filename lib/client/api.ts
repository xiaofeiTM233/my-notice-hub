// lib/client/api.ts
'use client'
import { API_BASE_URL } from '@/lib/shared/constants'

export type ApiMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export interface ApiRequestOptions {
  method?: ApiMethod
  body?: unknown
  query?: Record<string, unknown>
  signal?: AbortSignal
}

interface ApiEnvelope<T> {
  ok?: boolean
  data?: T
  error?: {
    code?: string
    message?: string
    details?: unknown
  }
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

function buildUrl(path: string, query?: Record<string, unknown>): string {
  const url = `${API_BASE_URL}${path}`
  if (!query) return url

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item))
      continue
    }
    params.set(key, String(value))
  }

  const queryString = params.toString()
  return queryString ? `${url}?${queryString}` : url
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal } = options
  const isForm = body instanceof FormData

  const response = await fetch(buildUrl(path, query), {
    method,
    signal,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: isForm || body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: isForm ? body : body === undefined ? undefined : JSON.stringify(body),
  })

  const text = await response.text()
  let payload: ApiEnvelope<T> | null = null
  try {
    payload = text ? (JSON.parse(text) as ApiEnvelope<T>) : null
  } catch {
    payload = null
  }

  if (!response.ok || !payload?.ok) {
    throw new ApiError(
      response.status,
      payload?.error?.code ?? 'INTERNAL',
      payload?.error?.message ?? `请求失败（${response.status}）`,
      payload?.error?.details,
    )
  }

  return payload.data as T
}
