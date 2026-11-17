// proxy.ts
import { NextResponse } from 'next/server'
import { auth } from '@/auth'

// Next 16 用 proxy 取代 middleware，运行时固定 Node.js。
export const proxy = auth((request) => {
  const { pathname } = request.nextUrl
  const isLoggedIn = Boolean(request.auth?.user)
  const isApi = pathname.startsWith('/api/admin')

  if (pathname === '/admin/login') {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL('/admin/notices', request.nextUrl))
    }
    return NextResponse.next()
  }

  if (isLoggedIn) return NextResponse.next()

  if (isApi) {
    const requestId = crypto.randomUUID()
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'UNAUTHORIZED', message: '请先登录' },
        meta: { requestId, tookMs: 0 },
      },
      { status: 401, headers: { 'x-request-id': requestId } },
    )
  }

  const loginUrl = new URL('/admin/login', request.nextUrl)
  loginUrl.searchParams.set('next', pathname)
  return NextResponse.redirect(loginUrl)
})

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
