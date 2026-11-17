// app/api/admin/import/commit/route.ts
import type { NextRequest } from 'next/server'
import dbConnect from '@/lib/db'
import { withApi } from '@/lib/server/respond'
import { readJson } from '@/lib/server/params'
import { requireAdmin } from '@/lib/server/guard'
import { conflict, notFound } from '@/lib/server/errors'
import { importCommitSchema } from '@/lib/shared/contracts/import'
import { noticeInputSchema, type NoticeInput } from '@/lib/shared/contracts/notice'
import { ImportJob } from '@/lib/server/models/import-job'
import { Notice } from '@/lib/server/models/notice'
import { createNotice, updateNotice } from '@/lib/server/queries/notice'

export const POST = withApi(async (request: NextRequest) => {
  await requireAdmin()
  const input = importCommitSchema.parse(await readJson(request))

  await dbConnect()
  const job = await ImportJob.findById(input.jobId)
  if (!job) throw notFound('导入任务不存在或已过期')
  if (job.status === 'committed') throw conflict('该导入任务已提交')

  let inserted = 0
  let skipped = 0
  let failed = 0
  const now = Math.floor(Date.now() / 1000)

  for (const raw of job.payload) {
    const parsed = noticeInputSchema.safeParse(raw)
    if (!parsed.success) {
      failed += 1
      continue
    }

    const notice: NoticeInput = {
      ...parsed.data,
      channel: input.channel ?? parsed.data.channel,
      timestamp: parsed.data.timestamp ?? now,
    }

    try {
      const existing = await Notice.findOne(
        { 'meta.timestamp': notice.timestamp, 'content.title': notice.title },
        { _id: 1 },
      ).lean<{ _id: unknown } | null>()

      if (existing) {
        if (input.duplicate === 'skip') {
          skipped += 1
          continue
        }
        await updateNotice(String(existing._id), notice)
        inserted += 1
        continue
      }

      await createNotice(notice)
      inserted += 1
    } catch {
      failed += 1
    }
  }

  job.status = 'committed'
  await job.save()

  return { inserted, skipped, failed }
})
