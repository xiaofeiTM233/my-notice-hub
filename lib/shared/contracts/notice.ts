// lib/shared/contracts/notice.ts
import { z } from 'zod'
import { objectIdSchema } from './common'
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_TAGS_PER_NOTICE,
  NOTICE_PRIORITIES,
} from '@/lib/shared/constants'

export const noticePrioritySchema = z.enum(NOTICE_PRIORITIES)

export const noticeSortSchema = z.enum(['newest', 'oldest'])

export const noticeQuerySchema = z.object({
  q: z.string().trim().max(80).default(''),
  channel: z.array(z.string().trim().min(1)).default([]),
  priority: z.array(noticePrioritySchema).default([]),
  tag: z.array(z.string().trim().min(1)).default([]),
  from: z.number().int().min(0).optional(),
  to: z.number().int().min(0).optional(),
  sort: noticeSortSchema.default('newest'),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
})

export const noticeAuthorSchema = z.object({
  name: z.string().trim().max(60).optional(),
  avatar: z.string().trim().optional(),
})

export const noticeInputSchema = z.object({
  channel: z.string().trim().min(1).max(60),
  priority: noticePrioritySchema.default('normal'),
  timestamp: z.number().int().min(0).optional(),
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(300).optional(),
  body: z.string().max(500_000).optional(),
  author: noticeAuthorSchema.optional(),
  cover: z.string().trim().optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(MAX_TAGS_PER_NOTICE).default([]),
  entities: z.array(z.string().trim()).default([]),
  extra: z.record(z.string(), z.unknown()).optional(),
})

// 注意：不能对带默认值的 create schema 调 partial，否则缺省字段会被填上默认值并覆盖原数据。
export const noticeUpdateSchema = z.object({
  channel: z.string().trim().min(1).max(60).optional(),
  priority: noticePrioritySchema.optional(),
  timestamp: z.number().int().min(0).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  summary: z.string().trim().max(300).optional(),
  body: z.string().max(500_000).optional(),
  author: noticeAuthorSchema.optional(),
  cover: z.string().trim().optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(MAX_TAGS_PER_NOTICE).optional(),
  entities: z.array(z.string().trim()).optional(),
  extra: z.record(z.string(), z.unknown()).optional(),
})

export const noticeSummaryDtoSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  channel: z.string(),
  priority: noticePrioritySchema,
  timestamp: z.number(),
  tags: z.array(z.string()),
  cover: z.string().nullable(),
  author: noticeAuthorSchema.nullable(),
  entityCount: z.number(),
})

export const noticeDetailDtoSchema = noticeSummaryDtoSchema.extend({
  body: z.string(),
  bodyFormat: z.enum(['markdown', 'html']),
  entities: z.array(z.string()),
  extra: z.record(z.string(), z.unknown()).optional(),
})

export type NoticePriorityValue = z.infer<typeof noticePrioritySchema>
export type NoticeInput = z.infer<typeof noticeInputSchema>
export type NoticeUpdateInput = z.infer<typeof noticeUpdateSchema>

export const noticeBatchDeleteSchema = z.object({
  ids: z.array(objectIdSchema).min(1).max(100),
})
