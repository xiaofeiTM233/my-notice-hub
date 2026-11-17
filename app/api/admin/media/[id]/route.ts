// app/api/admin/media/[id]/route.ts
import type { NextRequest } from 'next/server'
import dbConnect from '@/lib/db'
import { withApi } from '@/lib/server/respond'
import { readJson, requireObjectId } from '@/lib/server/params'
import { requireAdmin } from '@/lib/server/guard'
import { conflict, notFound } from '@/lib/server/errors'
import { mediaUpdateSchema } from '@/lib/shared/contracts/media'
import { removeMedia } from '@/lib/media'
import { Media, type IMedia } from '@/lib/server/models/media'
import { findMediaReferences } from '@/lib/server/queries/notice'
import { toMediaDto } from '@/lib/server/dto'

export const PATCH = withApi(
  async (request: NextRequest, context: RouteContext<'/api/admin/media/[id]'>) => {
    await requireAdmin()
    const { id } = await context.params
    const mediaId = requireObjectId(id)
    const input = mediaUpdateSchema.parse(await readJson(request))

    await dbConnect()
    const patch: Record<string, unknown> = {}
    if (input.name !== undefined) patch.name = input.name
    if (input.author !== undefined) patch.author = input.author

    const doc = await Media.findByIdAndUpdate(mediaId, { $set: patch }, { returnDocument: 'after' }).lean<IMedia | null>()
    if (!doc) throw notFound('媒体不存在')
    return toMediaDto(doc)
  },
)

export const DELETE = withApi(
  async (request: NextRequest, context: RouteContext<'/api/admin/media/[id]'>) => {
    await requireAdmin()
    const { id } = await context.params
    const mediaId = requireObjectId(id)
    const force = request.nextUrl.searchParams.get('force') === '1'

    await dbConnect()
    const media = await Media.findById(mediaId).lean<IMedia | null>()
    if (!media) throw notFound('媒体不存在')

    if (!force) {
      const references = await findMediaReferences(mediaId)
      if (references.length > 0) {
        throw conflict('媒体已被文章引用，确认后可强制删除', references)
      }
    }

    await removeMedia(media)
    await Media.deleteOne({ _id: mediaId })
    return { deleted: true }
  },
)
