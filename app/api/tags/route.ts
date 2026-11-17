// app/api/tags/route.ts
import type { NextRequest } from 'next/server'
import { withApi } from '@/lib/server/respond'
import { getTagStats } from '@/lib/server/queries/notice'

export const GET = withApi(async (request: NextRequest) => {
  const limitValue = Number(request.nextUrl.searchParams.get('limit') ?? 60)
  const limit = Number.isInteger(limitValue) && limitValue > 0 ? Math.min(limitValue, 100) : 60
  return getTagStats(limit)
})
