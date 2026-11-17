// lib/server/dto.ts
import 'server-only'
import sanitizeHtml from 'sanitize-html'
import type { ISetting, SettingMedia } from './models/setting'
import type { INotice } from './models/notice'
import type { IMedia } from './models/media'
import type {
  MediaDto,
  NoticeAuthorDto,
  NoticeDetailDto,
  NoticeSummaryDto,
  SettingDto,
  StorageFieldState,
} from '@/lib/shared/types'

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1',
    'h2',
    'h3',
    'h4',
    'p',
    'br',
    'hr',
    'strong',
    'em',
    'u',
    's',
    'blockquote',
    'ul',
    'ol',
    'li',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'code',
    'pre',
    'a',
    'img',
    'figure',
    'figcaption',
    'span',
    'div',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height', 'loading'],
    '*': ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => {
      const href = attribs.href ?? ''
      const external = /^https?:\/\//i.test(href)
      return {
        tagName,
        attribs: external
          ? { ...attribs, target: '_blank', rel: 'noopener noreferrer' }
          : attribs,
      }
    },
  },
}

export function detectBodyFormat(body: string): 'markdown' | 'html' {
  return /<\/?[a-z][a-z0-9]*(\s[^>]*)?>/i.test(body) ? 'html' : 'markdown'
}

export function sanitizeBodyHtml(body: string): string {
  return sanitizeHtml(body, SANITIZE_OPTIONS)
}

export function deriveSummary(body: string, limit = 120): string {
  const text = body
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*`_~|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.slice(0, limit)
}

function toAuthorDto(author?: { name?: string; avatar?: string } | null): NoticeAuthorDto | null {
  if (!author || (!author.name && !author.avatar)) return null
  return { name: author.name, avatar: author.avatar }
}

export function toNoticeSummary(doc: INotice): NoticeSummaryDto {
  return {
    id: String(doc._id),
    title: doc.content.title,
    summary: doc.content.summary || '',
    channel: doc.meta.channel,
    priority: doc.meta.priority,
    timestamp: doc.meta.timestamp,
    tags: doc.content.tags ?? [],
    cover: doc.content.cover || null,
    author: toAuthorDto(doc.content.author),
    entityCount: doc.content.entities?.length ?? 0,
  }
}

export function toNoticeDetail(doc: INotice, scope: 'public' | 'admin'): NoticeDetailDto {
  const rawBody = doc.content.body ?? ''
  const bodyFormat = detectBodyFormat(rawBody)
  const body =
    scope === 'public' && bodyFormat === 'html' ? sanitizeBodyHtml(rawBody) : rawBody

  return {
    ...toNoticeSummary(doc),
    body,
    bodyFormat,
    entities: doc.content.entities ?? [],
    extra: scope === 'admin' ? doc.extra : undefined,
  }
}

export function toMediaDto(doc: IMedia, size?: number): MediaDto {
  return {
    id: String(doc._id),
    type: doc.type,
    format: doc.format,
    name: doc.name ?? '',
    author: toAuthorDto(doc.author),
    url: `/api/media/${String(doc._id)}`,
    size,
  }
}

function maskSecret(value?: string): StorageFieldState {
  if (!value) return { set: false, hint: '' }
  const tail = value.slice(-4)
  return { set: true, hint: `••••${tail}` }
}

export function toSettingDto(setting: ISetting): SettingDto {
  const media: SettingMedia = setting.media
  return {
    admin: {
      username: setting.admin.username,
      passwordUpdatedAt: setting.admin.passwordUpdatedAt,
    },
    media: {
      type: media.type,
      maxUploadSize: media.maxUploadSize,
      allowedFormats: media.allowedFormats,
      credentials: {
        vercelToken: maskSecret(media.vercelToken),
        r2AccessKeyId: maskSecret(media.r2AccessKeyId),
        r2SecretAccessKey: maskSecret(media.r2SecretAccessKey),
        r2Endpoint: maskSecret(media.r2Endpoint),
        r2Bucket: maskSecret(media.r2Bucket),
        r2PublicUrl: maskSecret(media.r2PublicUrl),
        webdavUrl: maskSecret(media.webdavUrl),
        webdavUser: maskSecret(media.webdavUser),
        webdavPass: maskSecret(media.webdavPass),
        webdavBasePath: maskSecret(media.webdavBasePath),
        edgeoneToken: maskSecret(media.edgeoneToken),
        edgeoneProjectId: maskSecret(media.edgeoneProjectId),
        edgeoneStoreName: maskSecret(media.edgeoneStoreName),
      },
    },
  }
}
