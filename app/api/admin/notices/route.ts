// app/api/admin/notices/route.ts
import type { NextRequest } from 'next/server'
import { withApi } from '@/lib/server/respond'
import { readJson } from '@/lib/server/params'
import { requireAdmin } from '@/lib/server/guard'
import { noticeInputSchema, noticeQuerySchema } from '@/lib/shared/contracts/notice'
import { parseNoticeQuery } from '@/lib/shared/notice-query'
import { createNotice, listNotices } from '@/lib/server/queries/notice'
import { toNoticeDetail } from '@/lib/server/dto'

export const GET = withApi(async (request: NextRequest) => {
  await requireAdmin()
  const query = noticeQuerySchema.parse(parseNoticeQuery(request.nextUrl.searchParams))
  return listNotices(query, 'admin')
})

export const POST = withApi(async (request: NextRequest) => {
  await requireAdmin()
  const input = noticeInputSchema.parse(await readJson(request))
  const doc = await createNotice(input)
  return toNoticeDetail(doc, 'admin')
})
