// lib/shared/constants.ts

export const SITE_NAME = '通知中心'
export const SITE_DESCRIPTION = '内部通知与公告聚合站'
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? ''

export const NOTICE_PRIORITIES = ['urgent', 'high', 'normal', 'low'] as const
export type NoticePriority = (typeof NOTICE_PRIORITIES)[number]

export const PRIORITY_LABEL: Record<NoticePriority, string> = {
  urgent: '紧急',
  high: '高',
  normal: '普通',
  low: '低',
}

export const PRIORITY_COLOR: Record<NoticePriority, string> = {
  urgent: 'var(--priority-urgent)',
  high: 'var(--priority-high)',
  normal: 'var(--priority-normal)',
  low: 'var(--priority-low)',
}

export const MEDIA_TYPES = ['base64', 'url', 'r2', 'vercel', 'webdav', 'edgeone'] as const
export type MediaType = (typeof MEDIA_TYPES)[number]

export const MEDIA_TYPE_LABEL: Record<MediaType, string> = {
  base64: 'Base64（内置）',
  url: '外部链接（URL）',
  r2: 'Cloudflare R2',
  vercel: 'Vercel Blob',
  webdav: 'WebDAV',
  edgeone: 'EdgeOne Blob',
}

export const STORAGE_CREDENTIAL_KEYS = [
  'vercelToken',
  'r2AccessKeyId',
  'r2SecretAccessKey',
  'r2Endpoint',
  'r2Bucket',
  'r2PublicUrl',
  'webdavUrl',
  'webdavUser',
  'webdavPass',
  'webdavBasePath',
  'edgeoneToken',
  'edgeoneProjectId',
  'edgeoneStoreName',
] as const
export type StorageCredentialKey = (typeof STORAGE_CREDENTIAL_KEYS)[number]

export const STORAGE_FIELD_LABEL: Record<StorageCredentialKey, string> = {
  vercelToken: 'Vercel Blob Token',
  r2AccessKeyId: 'R2 Access Key ID',
  r2SecretAccessKey: 'R2 Secret Access Key',
  r2Endpoint: 'R2 Endpoint',
  r2Bucket: 'R2 存储桶',
  r2PublicUrl: 'R2 公开访问前缀',
  webdavUrl: 'WebDAV 地址',
  webdavUser: 'WebDAV 用户名',
  webdavPass: 'WebDAV 密码',
  webdavBasePath: 'WebDAV 基础路径',
  edgeoneToken: 'EdgeOne Token',
  edgeoneProjectId: 'EdgeOne 项目 ID',
  edgeoneStoreName: 'EdgeOne 存储名称',
}

export const STORAGE_TYPE_FIELDS: Record<MediaType, StorageCredentialKey[]> = {
  base64: [],
  url: [],
  r2: ['r2AccessKeyId', 'r2SecretAccessKey', 'r2Endpoint', 'r2Bucket'],
  vercel: ['vercelToken'],
  webdav: ['webdavUrl', 'webdavUser', 'webdavPass', 'webdavBasePath'],
  edgeone: ['edgeoneToken', 'edgeoneProjectId', 'edgeoneStoreName'],
}

export const LIST_VIEWS = ['card', 'list', 'feed'] as const
export type ListView = (typeof LIST_VIEWS)[number]

export const LIST_VIEW_LABEL: Record<ListView, string> = {
  card: '卡片',
  list: '列表',
  feed: '动态流',
}

export const THEME_MODES = ['light', 'system', 'dark'] as const
export type ThemeMode = (typeof THEME_MODES)[number]

export const DEFAULT_PAGE_SIZE = 12
export const MAX_PAGE_SIZE = 60
export const MAX_TAGS_PER_NOTICE = 8

export const UPLOAD_MAX_BYTES = 4 * 1024 * 1024
export const BASE64_MAX_BYTES = 512 * 1024
export const DEFAULT_ALLOWED_FORMATS = [
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'svg',
  'pdf',
  'zip',
  'docx',
  'xlsx',
  'mp4',
]

export const DEFAULT_ADMIN_USERNAME = 'admin'
export const DEFAULT_ADMIN_PASSWORD = '114514'
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60
export const LOGIN_RATE_LIMIT = 5
export const LOGIN_RATE_WINDOW_MS = 10 * 60 * 1000
