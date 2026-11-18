// lib/media.ts
import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { BASE64_MAX_BYTES, type MediaType } from '@/lib/shared/constants'
import dbConnect from '@/lib/db'
import { Media, type IMedia } from '@/lib/server/models/media'
import type { SettingMedia } from '@/lib/server/models/setting'
import { getSetting } from '@/lib/server/setting-store'
import { badRequest, storageError, upstreamError } from '@/lib/server/errors'

interface SaveResult {
  src: string
  size: number
}

interface Adapter {
  save(name: string, buffer: Buffer, format: string): Promise<SaveResult>
  load(src: string): Promise<Buffer>
  remove(src: string): Promise<void>
}

const MAX_PROXY_BYTES = 20 * 1024 * 1024
const FETCH_TIMEOUT_MS = 8_000

const MIME_BY_FORMAT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  pdf: 'application/pdf',
  txt: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
  zip: 'application/zip',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
}

export function mimeFromFormat(format: string): string {
  return MIME_BY_FORMAT[format.toLowerCase()] ?? 'application/octet-stream'
}

export function formatFromFilename(filename: string): string {
  const match = /\.([a-zA-Z0-9]{1,10})$/.exec(filename)
  return match ? match[1].toLowerCase() : 'bin'
}

export function mediaUrl(id: string): string {
  return `/api/media/${id}`
}

function objectKey(format: string): string {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${year}/${month}/${randomUUID()}.${format}`
}

function base64Adapter(): Adapter {
  return {
    async save(_name, buffer) {
      return { src: buffer.toString('base64'), size: buffer.length }
    },
    async load(src) {
      return Buffer.from(src.replace(/^data:[^;]+;base64,/, ''), 'base64')
    },
    async remove() {
      return
    },
  }
}

function urlAdapter(): Adapter {
  return {
    async save() {
      throw badRequest('当前存储类型为外部链接，不能上传文件')
    },
    async load(src) {
      const result = await fetchBuffer(src)
      return result.buffer
    },
    async remove() {
      return
    },
  }
}

async function r2Adapter(config: SettingMedia): Promise<Adapter> {
  const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } =
    await import('@aws-sdk/client-s3')

  if (!config.r2AccessKeyId || !config.r2SecretAccessKey || !config.r2Endpoint || !config.r2Bucket) {
    throw storageError('R2 凭证未配置完整，请在设置页填写')
  }

  const bucket = config.r2Bucket
  const client = new S3Client({
    region: 'auto',
    endpoint: config.r2Endpoint,
    credentials: {
      accessKeyId: config.r2AccessKeyId,
      secretAccessKey: config.r2SecretAccessKey,
    },
    forcePathStyle: false,
  })

  return {
    async save(_name, buffer, format) {
      const key = objectKey(format)
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: mimeFromFormat(format),
        }),
      )
      return { src: key, size: buffer.length }
    },
    async load(src) {
      const key = src.includes('://') ? new URL(src).pathname.replace(/^\//, '') : src
      const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
      if (!response.Body) throw storageError(`R2 对象 ${key} 不存在`)
      return Buffer.from(await response.Body.transformToByteArray())
    },
    async remove(src) {
      const key = src.includes('://') ? new URL(src).pathname.replace(/^\//, '') : src
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    },
  }
}

async function vercelAdapter(config: SettingMedia): Promise<Adapter> {
  const { put, del } = await import('@vercel/blob')
  if (!config.vercelToken) throw storageError('Vercel Blob Token 未配置')

  const token = config.vercelToken
  return {
    async save(_name, buffer, format) {
      const blob = await put(objectKey(format), buffer, {
        access: 'public',
        token,
        contentType: mimeFromFormat(format),
        addRandomSuffix: false,
      })
      return { src: blob.url, size: buffer.length }
    },
    async load(src) {
      const response = await fetch(src, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      if (!response.ok) throw storageError(`Vercel Blob 读取失败：${response.status}`)
      return Buffer.from(await response.arrayBuffer())
    },
    async remove(src) {
      await del(src, { token })
    },
  }
}

async function webdavAdapter(config: SettingMedia): Promise<Adapter> {
  const { createClient } = await import('webdav')
  if (!config.webdavUrl || !config.webdavUser || !config.webdavPass) {
    throw storageError('WebDAV 凭证未配置完整')
  }

  const basePath = `${(config.webdavBasePath || '/notice').replace(/\/+$/, '')}/`
  const client = createClient(config.webdavUrl, {
    username: config.webdavUser,
    password: config.webdavPass,
  })

  return {
    async save(_name, buffer, format) {
      const key = objectKey(format)
      // 目录已存在时 createDirectory 会报错，这里忽略即可。
      await client.createDirectory(basePath).catch(() => undefined)
      await client.putFileContents(`${basePath}${key}`, buffer, { overwrite: true })
      return { src: key, size: buffer.length }
    },
    async load(src) {
      const path = src.startsWith('/') ? src : `${basePath}${src}`
      const content = (await client.getFileContents(path)) as Buffer | ArrayBuffer | string
      if (typeof content === 'string') return Buffer.from(content)
      return Buffer.isBuffer(content) ? content : Buffer.from(content)
    },
    async remove(src) {
      const path = src.startsWith('/') ? src : `${basePath}${src}`
      await client.deleteFile(path)
    },
  }
}

async function edgeoneAdapter(config: SettingMedia): Promise<Adapter> {
  const { getStore } = await import('@edgeone/pages-blob')
  if (!config.edgeoneToken || !config.edgeoneProjectId || !config.edgeoneStoreName) {
    throw storageError('EdgeOne Blob 凭证未配置完整')
  }

  const store = getStore({
    name: config.edgeoneStoreName,
    projectId: config.edgeoneProjectId,
    token: config.edgeoneToken,
  })

  return {
    async save(_name, buffer, format) {
      const key = objectKey(format)
      // Buffer 的底层可能是 SharedArrayBuffer，先复制到独立 ArrayBuffer 再交给 SDK。
      const copy = new Uint8Array(buffer.byteLength)
      copy.set(buffer)
      await store.set(key, copy.buffer as ArrayBuffer)
      return { src: key, size: buffer.length }
    },
    async load(src) {
      const result = await store.get(src, { type: 'arrayBuffer' })
      if (result === null) throw storageError(`EdgeOne 对象 ${src} 不存在`)
      return Buffer.from(result)
    },
    async remove(src) {
      await store.delete(src)
    },
  }
}

export async function createAdapter(config: SettingMedia, type: MediaType = config.type): Promise<Adapter> {
  switch (type) {
    case 'base64':
      return base64Adapter()
    case 'url':
      return urlAdapter()
    case 'r2':
      return r2Adapter(config)
    case 'vercel':
      return vercelAdapter(config)
    case 'webdav':
      return webdavAdapter(config)
    case 'edgeone':
      return edgeoneAdapter(config)
    default:
      throw storageError(`不支持的存储类型：${String(type)}`)
  }
}

export async function getMediaConfig(): Promise<SettingMedia> {
  const setting = await getSetting()
  return setting.media
}

export interface SaveMediaInput {
  name: string
  buffer: Buffer
  format: string
  author?: { name?: string; avatar?: string }
  // 复用已存在的同内容媒体时返回 true，调用方据此跳过重复写入
  dedupe?: boolean
}

export function hashBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

// 返回已存在的同内容媒体，避免同一张图重复占用存储
export async function findMediaByHash(hash: string): Promise<IMedia | null> {
  await dbConnect()
  return Media.findOne({ hash }, { _id: 1, type: 1, src: 1, format: 1, name: 1, author: 1, hash: 1 }).lean<IMedia | null>()
}

// 下载远端文件并计算内容哈希，用于识别同一张图的不同地址
export async function fetchRemoteHash(
  source: string,
  referer?: string,
): Promise<{ hash: string; size: number }> {
  const { buffer } = await fetchBuffer(source, referer)
  return { hash: hashBuffer(buffer), size: buffer.length }
}

export async function saveMedia(input: SaveMediaInput): Promise<IMedia> {
  const config = await getMediaConfig()
  const format = input.format.toLowerCase()

  if (config.type === 'url') {
    throw badRequest('当前存储类型为外部链接，不能上传文件')
  }
  if (!config.allowedFormats.includes(format)) {
    throw badRequest(`不支持的格式：${format}`)
  }

  const limit = config.type === 'base64' ? Math.min(config.maxUploadSize, BASE64_MAX_BYTES) : config.maxUploadSize
  if (input.buffer.length > limit) {
    throw badRequest(`文件超过上限 ${Math.floor(limit / 1024)} KB`)
  }

  await dbConnect()
  const hash = hashBuffer(input.buffer)
  // 上传同字节文件直接复用已有媒体，不重复占存储
  if (input.dedupe !== false) {
    const existing = await Media.findOne({ hash }).lean<IMedia | null>()
    if (existing) return existing
  }

  const adapter = await createAdapter(config)
  const result = await adapter.save(input.name, input.buffer, format)
  const doc = await Media.create({
    type: config.type,
    src: result.src,
    format,
    name: input.name,
    author: input.author,
    hash,
  })
  return doc
}

export async function readMedia(media: IMedia): Promise<{ buffer: Buffer; mime: string }> {
  const mime = mimeFromFormat(media.format)

  if (media.type === 'base64') {
    return { buffer: Buffer.from(media.src.replace(/^data:[^;]+;base64,/, ''), 'base64'), mime }
  }
  if (media.type === 'url') {
    // 部分图床校验来源页，媒体上的 referer 供代理请求带上
    const result = await fetchBuffer(media.src, media.referer)
    return { buffer: result.buffer, mime: result.contentType ?? mime }
  }

  const config = await getMediaConfig()
  const adapter = await createAdapter(config, media.type)
  return { buffer: await adapter.load(media.src), mime }
}

export async function removeMedia(media: IMedia): Promise<void> {
  if (media.type === 'base64' || media.type === 'url') return

  const config = await getMediaConfig()
  const adapter = await createAdapter(config, media.type)
  await adapter.remove(media.src)
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const value = address.toLowerCase()
    return (
      value === '::1' ||
      value === '::' ||
      value.startsWith('fc') ||
      value.startsWith('fd') ||
      value.startsWith('fe80')
    )
  }

  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true
  const [a, b] = parts
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  )
}

async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw upstreamError('仅支持 http/https 链接')
  }

  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw upstreamError('不允许访问内网地址')
    return
  }

  const records = await lookup(host, { all: true }).catch(() => [])
  if (records.length === 0) throw upstreamError('域名解析失败')
  if (records.some((record) => isPrivateAddress(record.address))) {
    throw upstreamError('不允许访问内网地址')
  }
}

async function fetchBuffer(
  source: string,
  referer?: string,
): Promise<{ buffer: Buffer; contentType: string | null }> {
  let current = new URL(source)

  for (let hop = 0; hop < 3; hop += 1) {
    await assertPublicUrl(current)
    const response = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: 'no-store',
      headers: referer ? { referer } : undefined,
    })

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) throw upstreamError('上游重定向缺少目标地址')
      current = new URL(location, current)
      continue
    }
    if (!response.ok) throw upstreamError(`上游返回 ${response.status}`)

    const declared = Number(response.headers.get('content-length') ?? 0)
    if (declared > MAX_PROXY_BYTES) throw upstreamError('文件超过代理上限')

    const body = Buffer.from(await response.arrayBuffer())
    if (body.length > MAX_PROXY_BYTES) throw upstreamError('文件超过代理上限')
    return { buffer: body, contentType: response.headers.get('content-type') }
  }

  throw upstreamError('重定向次数过多')
}
