// lib/server/import/media.ts
import 'server-only'
import { createHash } from 'node:crypto'
import { fetchRemoteHash, formatFromFilename, mediaUrl } from '@/lib/media'
import { Media } from '@/lib/server/models/media'
import type { NoticeInput } from '@/lib/shared/contracts/notice'

const IMG_TAG_RE = /<img\b[^>]*>/gi
const IMG_SRC_RE = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i
const MEDIA_NAME_LENGTH = 60
// 并发下载原图算哈希，避免同时打满图床
const HASH_CONCURRENCY = 4

export interface NoticeMediaOptions {
  author: { name: string }
  // 日志前缀，便于区分是哪个适配器在登记图片
  warningLabel: string
  // 外链媒体代理时带上的来源页，部分图床会校验
  referer?: string
  // 命中时把正文首图作为封面并从正文移除（如聚合接口的图片频道）
  coverFromBody?: (notice: NoticeInput) => boolean
  // 命中且没有封面时，用正文首图补封面，但保留正文里的图
  coverFromFirstImage?: (notice: NoticeInput) => boolean
}

type ResolveMedia = (url: string, name: string) => Promise<string | null>

function isExternalUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function imgSrc(tag: string): string {
  const match = IMG_SRC_RE.exec(tag)
  return match ? (match[1] ?? match[2] ?? '') : ''
}

function mediaName(title: string, suffix: string): string {
  const base = title
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MEDIA_NAME_LENGTH)
  return `${base || '公告配图'} ${suffix}`
}

// 图床会给同一张图生成不同日期的路径，按地址去重挡不住，这里用地址指纹兜底
export function urlFingerprint(url: string): string {
  return createHash('sha256').update(url.trim()).digest('hex')
}

function createLimiter(limit: number) {
  let active = 0
  const waiting: (() => void)[] = []
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active >= limit) await new Promise<void>((resolve) => waiting.push(resolve))
    active += 1
    try {
      return await task()
    } finally {
      active -= 1
      waiting.shift()?.()
    }
  }
}

interface RegisterContext {
  author: { name: string }
  referer?: string
  warningLabel: string
  run: <T>(task: () => Promise<T>) => Promise<T>
}

// 公告图片统一以外部链接媒体登记，不转存字节，由 /api/media/{id} 代理访问
async function registerMedia(
  url: string,
  name: string,
  context: RegisterContext,
): Promise<string> {
  const urlHash = urlFingerprint(url)
  const existing = await Media.findOne(
    { $or: [{ type: 'url', src: url }, { hash: urlHash }] },
    { _id: 1 },
  ).lean<{ _id: unknown } | null>()
  if (existing) return String(existing._id)

  // 先按内容哈希找同图不同址：命中就复用已有媒体，不再新增记录
  const contentHash = await context.run(() =>
    fetchRemoteHash(url, context.referer)
      .then((result) => result.hash)
      .catch((error: unknown) => {
        // 下载失败不影响导入，退化为按地址指纹去重
        console.warn(`${context.warningLabel} 计算图片哈希失败，按地址去重`, url, error)
        return ''
      }),
  )
  if (contentHash) {
    const sameContent = await Media.findOne({ hash: contentHash }, { _id: 1 }).lean<{
      _id: unknown
    } | null>()
    if (sameContent) return String(sameContent._id)
  }

  const doc = await Media.create({
    type: 'url',
    src: url,
    format: formatFromFilename(new URL(url).pathname),
    name,
    author: context.author,
    referer: context.referer,
    hash: contentHash || urlHash,
  })
  return String(doc._id)
}

function createResolver(options: NoticeMediaOptions): ResolveMedia {
  // 同一张图在整批里只登记一次，并复用进行中的任务
  const cache = new Map<string, Promise<string | null>>()
  const context: RegisterContext = {
    author: options.author,
    referer: options.referer,
    warningLabel: options.warningLabel,
    run: createLimiter(HASH_CONCURRENCY),
  }

  return (url, name) => {
    const cached = cache.get(url)
    if (cached) return cached

    const task = registerMedia(url, name, context).catch((error: unknown) => {
      // 单张图片失败不阻断导入，正文保留原始外链
      console.warn(`${options.warningLabel} 图片登记媒体失败，正文保留外链`, url, error)
      return null
    })
    cache.set(url, task)
    return task
  }
}

async function attachOne(
  notice: NoticeInput,
  resolve: ResolveMedia,
  options: NoticeMediaOptions,
): Promise<NoticeInput> {
  const body = notice.body ?? ''
  const bodyUrls = [...new Set((body.match(IMG_TAG_RE) ?? []).map(imgSrc).filter(isExternalUrl))]
  const coverUrl = notice.cover && isExternalUrl(notice.cover) ? notice.cover : ''
  const stripBodyImages = options.coverFromBody?.(notice) ?? false
  const borrowFirstImage = !stripBodyImages && !coverUrl && (options.coverFromFirstImage?.(notice) ?? false)

  if (bodyUrls.length === 0 && !coverUrl) return notice

  const coverId = coverUrl ? await resolve(coverUrl, mediaName(notice.title, '封面')) : null
  const bodyIds = await Promise.all(
    bodyUrls.map((url, index) => resolve(url, mediaName(notice.title, String(index + 1)))),
  )

  const idByUrl = new Map<string, string>()
  bodyUrls.forEach((url, index) => {
    const id = bodyIds[index]
    if (id) idByUrl.set(url, id)
  })

  let nextBody = body.replace(IMG_TAG_RE, (tag) => {
    const src = imgSrc(tag)
    const id = src ? idByUrl.get(src) : undefined
    if (!id) return tag
    // 封面已单独展示，正文里同一张图去掉避免详情页重复；图片公告整段配图都并入封面
    if (stripBodyImages || src === coverUrl) return ''
    return tag.replace(src, mediaUrl(id))
  })
  if (stripBodyImages || coverUrl) nextBody = nextBody.replace(/<p>\s*<\/p>/gi, '')

  // 图片公告整段配图并入封面；缺封面的富文本取正文首图当封面，正文保持原样
  const resolvedCover = stripBodyImages || borrowFirstImage
    ? (bodyIds.find((id): id is string => Boolean(id)) ?? coverId)
    : coverId
  return resolvedCover ? { ...notice, body: nextBody, cover: resolvedCover } : { ...notice, body: nextBody }
}

export async function attachNoticeMedia(
  payload: NoticeInput[],
  options: NoticeMediaOptions,
): Promise<NoticeInput[]> {
  const resolve = createResolver(options)
  return Promise.all(payload.map((notice) => attachOne(notice, resolve, options)))
}
