// app/api/notices/route.ts
import type { NextRequest } from 'next/server'
import { withApi } from '@/lib/server/respond'
import { noticeQuerySchema } from '@/lib/shared/contracts/notice'
import { parseNoticeQuery } from '@/lib/shared/notice-query'
import { listNotices } from '@/lib/server/queries/notice'

export const GET = withApi(async (request: NextRequest) => {
  const query = noticeQuerySchema.parse(parseNoticeQuery(request.nextUrl.searchParams))
  return listNotices(query, 'public')
})
