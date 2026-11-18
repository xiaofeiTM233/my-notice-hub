// app/api/admin/media/route.ts
import type { NextRequest } from 'next/server'
import dbConnect from '@/lib/db'
import { withApi } from '@/lib/server/respond'
import { readFormData, readFormFile } from '@/lib/server/params'
import { requireAdmin } from '@/lib/server/guard'
import { badRequest } from '@/lib/server/errors'
import { mediaQuerySchema } from '@/lib/shared/contracts/media'
import { formatFromFilename, hashBuffer, saveMedia } from '@/lib/media'
import { Media, type IMedia } from '@/lib/server/models/media'
import { toMediaDto } from '@/lib/server/dto'
import { UPLOAD_MAX_BYTES } from '@/lib/shared/constants'

function intParam(value: string | null, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export const GET = withApi(async (request: NextRequest) => {
  await requireAdmin()
  const params = request.nextUrl.searchParams
  const query = mediaQuerySchema.parse({
    q: (params.get('q') ?? '').trim(),
    type: params.get('type') ?? undefined,
    format: params.get('format') ?? undefined,
    page: intParam(params.get('page'), 1),
    pageSize: intParam(params.get('pageSize'), 24),
  })

  await dbConnect()
  const filter: Record<string, unknown> = {}
  if (query.q) filter.name = new RegExp(escapeRegExp(query.q), 'i')
  if (query.type) filter.type = query.type
  if (query.format) filter.format = query.format

  const [docs, total] = await Promise.all([
    Media.find(filter)
      .sort({ _id: -1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .lean<IMedia[]>(),
    Media.countDocuments(filter),
  ])

  return {
    items: docs.map((doc) => toMediaDto(doc)),
    total,
    page: query.page,
    pageSize: query.pageSize,
  }
})

export const POST = withApi(async (request: NextRequest) => {
  await requireAdmin()
  const form = await readFormData(request)
  const file = readFormFile(form)

  if (file.size > UPLOAD_MAX_BYTES) {
    throw badRequest(`文件超过上限 ${Math.floor(UPLOAD_MAX_BYTES / 1024 / 1024)} MB`)
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const format = formatFromFilename(file.name)
  const authorName = form.get('author')

  const media = await saveMedia({
    name: file.name,
    buffer,
    format,
    author: typeof authorName === 'string' && authorName.trim() ? { name: authorName.trim() } : undefined,
  })

  // 命中去重时返回已有媒体，前端提示“已存在同一文件”
  return { ...toMediaDto(media, buffer.length), deduped: media.hash === hashBuffer(buffer) }
})
