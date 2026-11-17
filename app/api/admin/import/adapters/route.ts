// app/api/admin/import/adapters/route.ts
import { withApi } from '@/lib/server/respond'
import { requireAdmin } from '@/lib/server/guard'
import { listImportAdapters } from '@/lib/server/import/registry'

export const GET = withApi(async () => {
  await requireAdmin()
  return listImportAdapters()
})
