// app/api/admin/import/commit/route.ts
import type { NextRequest } from 'next/server'
import dbConnect from '@/lib/db'
import { withApi } from '@/lib/server/respond'
import { readJson } from '@/lib/server/params'
import { requireAdmin } from '@/lib/server/guard'
import { conflict, notFound } from '@/lib/server/errors'
import { commitPayload } from '@/lib/server/import/commit'
import { importCommitSchema } from '@/lib/shared/contracts/import'
import { ImportJob } from '@/lib/server/models/import-job'

export const POST = withApi(async (request: NextRequest) => {
  await requireAdmin()
  const input = importCommitSchema.parse(await readJson(request))

  await dbConnect()
  const job = await ImportJob.findById(input.jobId)
  if (!job) throw notFound('导入任务不存在或已过期')
  if (job.status === 'committed') throw conflict('该导入任务已提交')

  const report = await commitPayload({
    adapterId: job.adapter,
    payload: job.payload,
    channel: input.channel,
    duplicate: input.duplicate,
  })

  job.status = 'committed'
  await job.save()

  return report
})