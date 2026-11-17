// app/api/media/[id]/route.ts
import type { NextRequest } from 'next/server'
import dbConnect from '@/lib/db'
import { withApi } from '@/lib/server/respond'
import { requireObjectId } from '@/lib/server/params'
import { notFound } from '@/lib/server/errors'
import { readMedia } from '@/lib/media'
import { Media, type IMedia } from '@/lib/server/models/media'

function buildHeaders(
  media: IMedia,
  mediaId: string,
  length: number,
  download: boolean,
  mime: string,
): Headers {
  const filename = media.name || `media-${mediaId}.${media.format}`
  const disposition = download
    ? `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
    : 'inline'

  return new Headers({
    'Content-Type': mime,
    'Content-Length': String(length),
    'Content-Disposition': disposition,
    ETag: `"m-${mediaId}"`,
    'Cache-Control':
      media.type === 'url' ? 'public, max-age=3600' : 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'",
  })
}

async function loadMedia(mediaId: string) {
  await dbConnect()
  const media = await Media.findById(mediaId).lean<IMedia | null>()
  if (!media) throw notFound('媒体不存在')
  return media
}

export const GET = withApi(
  async (request: NextRequest, context: RouteContext<'/api/media/[id]'>) => {
    const { id } = await context.params
    const mediaId = requireObjectId(id)
    const media = await loadMedia(mediaId)
    const etag = `"m-${mediaId}"`

    if (request.headers.get('if-none-match') === etag) {
      const cacheControl =
        media.type === 'url' ? 'public, max-age=3600' : 'public, max-age=31536000, immutable'
      return new Response(null, { status: 304, headers: { ETag: etag, 'Cache-Control': cacheControl } })
    }

    const { buffer, mime } = await readMedia(media)
    const download = request.nextUrl.searchParams.get('download') === '1'

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: buildHeaders(media, mediaId, buffer.length, download, mime),
    })
  },
)

export const HEAD = withApi(
  async (request: NextRequest, context: RouteContext<'/api/media/[id]'>) => {
    const { id } = await context.params
    const mediaId = requireObjectId(id)
    const media = await loadMedia(mediaId)
    const { buffer, mime } = await readMedia(media)
    const download = request.nextUrl.searchParams.get('download') === '1'

    return new Response(null, {
      status: 200,
      headers: buildHeaders(media, mediaId, buffer.length, download, mime),
    })
  },
)
