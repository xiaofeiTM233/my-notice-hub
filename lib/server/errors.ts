// lib/server/errors.ts
import 'server-only'

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_FAILED'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'STORAGE_ERROR'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL'

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_FAILED: 422,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  STORAGE_ERROR: 502,
  UPSTREAM_ERROR: 502,
  INTERNAL: 500,
}

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number
  readonly details?: unknown

  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = STATUS_BY_CODE[code]
    this.details = details
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError('BAD_REQUEST', message, details)

export const notFound = (message = '资源不存在') => new ApiError('NOT_FOUND', message)

export const unauthorized = (message = '请先登录') => new ApiError('UNAUTHORIZED', message)

export const conflict = (message: string, details?: unknown) =>
  new ApiError('CONFLICT', message, details)

export const rateLimited = (message = '操作过于频繁，请稍后再试') =>
  new ApiError('RATE_LIMITED', message)

export const storageError = (message: string, details?: unknown) =>
  new ApiError('STORAGE_ERROR', message, details)

export const upstreamError = (message: string, details?: unknown) =>
  new ApiError('UPSTREAM_ERROR', message, details)

export const internalError = (message = '服务内部错误', details?: unknown) =>
  new ApiError('INTERNAL', message, details)
