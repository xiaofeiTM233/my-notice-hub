// app/api/admin/notices/[id]/route.ts
import { withApi } from '@/lib/server/respond'
import { readJson, requireObjectId } from '@/lib/server/params'
import { requireAdmin } from '@/lib/server/guard'
import { noticeUpdateSchema } from '@/lib/shared/contracts/notice'
import { deleteNotice, getNoticeDetail, updateNotice } from '@/lib/server/queries/notice'
import { toNoticeDetail } from '@/lib/server/dto'

export const GET = withApi(
  async (_request, context: RouteContext<'/api/admin/notices/[id]'>) => {
    await requireAdmin()
    const { id } = await context.params
    return getNoticeDetail(requireObjectId(id), 'admin')
  },
)

export const PATCH = withApi(
  async (request, context: RouteContext<'/api/admin/notices/[id]'>) => {
    await requireAdmin()
    const { id } = await context.params
    const input = noticeUpdateSchema.parse(await readJson(request))
    const doc = await updateNotice(requireObjectId(id), input)
    return toNoticeDetail(doc, 'admin')
  },
)

export const DELETE = withApi(
  async (_request, context: RouteContext<'/api/admin/notices/[id]'>) => {
    await requireAdmin()
    const { id } = await context.params
    await deleteNotice(requireObjectId(id))
    return { deleted: true }
  },
)
