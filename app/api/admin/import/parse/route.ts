// app/api/admin/import/parse/route.ts
import type { NextRequest } from 'next/server'
import dbConnect from '@/lib/db'
import { withApi } from '@/lib/server/respond'
import { readFormData, readFormFile } from '@/lib/server/params'
import { requireAdmin } from '@/lib/server/guard'
import { badRequest } from '@/lib/server/errors'
import { getImportAdapter, importAdapters } from '@/lib/server/import/registry'
import { noticeInputSchema } from '@/lib/shared/contracts/notice'
import { ImportJob } from '@/lib/server/models/import-job'
import { UPLOAD_MAX_BYTES } from '@/lib/shared/constants'

const MAX_INVALID_DETAILS = 200
const MAX_SAMPLE = 20

export const POST = withApi(async (request: NextRequest) => {
  await requireAdmin()

  if (importAdapters.length === 0) {
    throw badRequest('尚未注册任何导入适配器，请先在 lib/server/import/registry.ts 注册')
  }

  const form = await readFormData(request)
  const adapterId = form.get('adapter')
  if (typeof adapterId !== 'string' || !adapterId) throw badRequest('缺少适配器标识')

  const adapter = getImportAdapter(adapterId)
  if (!adapter) throw badRequest(`未找到适配器：${adapterId}`)

  const file = readFormFile(form)
  if (file.size > UPLOAD_MAX_BYTES) {
    throw badRequest(`导入文件超过上限 ${Math.floor(UPLOAD_MAX_BYTES / 1024 / 1024)} MB`)
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const raws = await adapter.parse({ filename: file.name, mime: file.type || 'application/octet-stream', buffer })

  const payload: unknown[] = []
  const invalid: { index: number; path: string; message: string }[] = []

  raws.forEach((raw, index) => {
    const parsed = noticeInputSchema.safeParse(raw)
    if (parsed.success) {
      payload.push(parsed.data)
      return
    }
    for (const issue of parsed.error.issues) {
      invalid.push({
        index,
        path: issue.path.map(String).join('.') || '(root)',
        message: issue.message,
      })
    }
  })

  await dbConnect()
  const now = new Date()
  const job = await ImportJob.create({
    adapter: adapter.id,
    filename: file.name,
    mime: file.type || 'application/octet-stream',
    size: file.size,
    status: 'parsed',
    total: raws.length,
    validCount: payload.length,
    invalidCount: raws.length - payload.length,
    invalid: invalid.slice(0, MAX_INVALID_DETAILS),
    payload,
    createdAt: now,
    expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
  })

  return {
    jobId: String(job._id),
    adapter: adapter.id,
    filename: file.name,
    total: raws.length,
    validCount: payload.length,
    invalidCount: raws.length - payload.length,
    invalid: invalid.slice(0, MAX_INVALID_DETAILS),
    sample: payload.slice(0, MAX_SAMPLE),
  }
})
