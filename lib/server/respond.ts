// lib/server/respond.ts
import 'server-only'
import { randomUUID } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { unstable_rethrow } from 'next/navigation'
import { ZodError } from 'zod'
import { ApiError, internalError, isApiError } from './errors'

export interface ApiMeta {
  requestId: string
  tookMs: number
}

export interface ApiEnvelope<T> {
  ok: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
  meta: ApiMeta
}

function zodDetails(error: ZodError): { path: string; message: string }[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.') || '(root)',
    message: issue.message,
  }))
}

function toApiError(error: unknown): ApiError {
  if (isApiError(error)) return error
  if (error instanceof ZodError) {
    return new ApiError('VALIDATION_FAILED', '请求参数校验失败', zodDetails(error))
  }
  if (error instanceof Error) {
    const duplicate = 'code' in error && (error as { code?: number }).code === 11000
    if (duplicate) return new ApiError('CONFLICT', '数据已存在')
  }
  return internalError()
}

export function withApi<A extends unknown[]>(
  handler: (request: NextRequest, ...args: A) => Promise<unknown>,
): (request: NextRequest, ...args: A) => Promise<Response> {
  return async (request: NextRequest, ...args: A): Promise<Response> => {
    const requestId = randomUUID()
    const startedAt = Date.now()
    const meta = (): ApiMeta => ({ requestId, tookMs: Date.now() - startedAt })

    try {
      const result = await handler(request, ...args)
      if (result instanceof Response) {
        result.headers.set('x-request-id', requestId)
        return result
      }
      return NextResponse.json(
        { ok: true, data: result ?? null, meta: meta() },
        { headers: { 'x-request-id': requestId } },
      )
    } catch (error) {
      // Next 的预渲染中断等内部控制流必须放行，否则会把动态路由固化成 500。
      unstable_rethrow(error)
      const apiError = toApiError(error)
      if (apiError.code === 'INTERNAL') {
        console.error(`[api] ${requestId} ${request.method} ${request.nextUrl.pathname}`, error)
      }
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: apiError.code,
            message: apiError.message,
            details: apiError.details,
          },
          meta: meta(),
        },
        { status: apiError.status, headers: { 'x-request-id': requestId } },
      )
    }
  }
}
