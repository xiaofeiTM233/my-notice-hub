// lib/shared/types.ts
import type { MediaType, NoticePriority } from './constants'

export interface NoticeAuthorDto {
  name?: string
  avatar?: string
}

export interface NoticeSummaryDto {
  id: string
  title: string
  summary: string
  channel: string
  priority: NoticePriority
  timestamp: number
  tags: string[]
  cover: string | null
  author: NoticeAuthorDto | null
  entityCount: number
}

export interface NoticeDetailDto extends NoticeSummaryDto {
  body: string
  bodyFormat: 'markdown' | 'html'
  entities: string[]
  extra?: Record<string, unknown>
}

export interface NoticeNeighborDto {
  id: string
  title: string
}

export interface NoticeAttachmentDto {
  id: string
  name: string
  format: string
}

export interface NoticeDetailResponse extends NoticeDetailDto {
  prev: NoticeNeighborDto | null
  next: NoticeNeighborDto | null
  attachments: NoticeAttachmentDto[]
}

export interface MediaDto {
  id: string
  type: MediaType
  format: string
  name: string
  author: NoticeAuthorDto | null
  url: string
  size?: number
}

export interface ChannelStat {
  channel: string
  count: number
}

export interface TagStat {
  tag: string
  count: number
}

export interface StorageFieldState {
  set: boolean
  hint: string
}

export interface SettingDto {
  admin: {
    username: string
    passwordUpdatedAt: number
  }
  media: {
    type: MediaType
    maxUploadSize: number
    allowedFormats: string[]
    credentials: Record<string, StorageFieldState>
  }
}

export interface ImportAdapterInfo {
  id: string
  label: string
  accepts: string[]
  remote: boolean
  description?: string
}

export interface ImportInvalidDto {
  index: number
  path: string
  message: string
}

export interface ImportPreviewDto {
  jobId: string
  adapter: string
  filename: string
  total: number
  validCount: number
  invalidCount: number
  invalid: ImportInvalidDto[]
  sample: unknown[]
}

export interface ImportReportDto {
  inserted: number
  skipped: number
  failed: number
}

export interface StorageTestResultDto {
  ok: boolean
  type: MediaType
  tookMs: number
}

export interface MediaReferenceDto {
  id: string
  title: string
}
