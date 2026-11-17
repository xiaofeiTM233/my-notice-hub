// app/api/admin/notices/batch/route.ts
import type { NextRequest } from 'next/server'
import { withApi } from '@/lib/server/respond'
import { readJson } from '@/lib/server/params'
import { requireAdmin } from '@/lib/server/guard'
import { noticeBatchDeleteSchema } from '@/lib/shared/contracts/notice'
import { deleteNotices } from '@/lib/server/queries/notice'

export const POST = withApi(async (request: NextRequest) => {
  await requireAdmin()
  const { ids } = noticeBatchDeleteSchema.parse(await readJson(request))
  const deleted = await deleteNotices(ids)
  return { deleted }
})
