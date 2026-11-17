// app/api/notices/[id]/route.ts
import { withApi } from '@/lib/server/respond'
import { requireObjectId } from '@/lib/server/params'
import { getNoticeDetail } from '@/lib/server/queries/notice'

export const GET = withApi(async (_request, context: RouteContext<'/api/notices/[id]'>) => {
  const { id } = await context.params
  return getNoticeDetail(requireObjectId(id), 'public')
})
