// app/api/admin/import/run/route.ts
import { withApi } from '@/lib/server/respond'
import { requireAdmin } from '@/lib/server/guard'
import { runAutoImport } from '@/lib/server/import/run'

export const POST = withApi(async () => {
  await requireAdmin()
  return runAutoImport({ force: true })
})
