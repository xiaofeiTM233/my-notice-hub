// lib/server/queries/notice.ts
import 'server-only'
import { isValidObjectId, type QueryFilter } from 'mongoose'
import dbConnect from '@/lib/db'
import { Notice, type INotice } from '../models/notice'
import { deriveSummary, toNoticeDetail, toNoticeSummary } from '../dto'
import { notFound } from '../errors'
import type { Paginated } from '@/lib/shared/contracts/common'
import type { NoticeInput, NoticeUpdateInput } from '@/lib/shared/contracts/notice'
import type { NoticeQuery } from '@/lib/shared/notice-query'
import type {
  ChannelStat,
  NoticeAttachmentDto,
  NoticeDetailResponse,
  NoticeSummaryDto,
  TagStat,
} from '@/lib/shared/types'

type Scope = 'public' | 'admin'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildFilter(query: NoticeQuery): QueryFilter<INotice> {
  const filter: QueryFilter<INotice> = {}

  if (query.q) {
    const pattern = new RegExp(escapeRegExp(query.q), 'i')
    filter.$or = [{ 'content.title': pattern }, { 'content.summary': pattern }]
  }
  if (query.channel.length) filter['meta.channel'] = { $in: query.channel }
  if (query.priority.length) filter['meta.priority'] = { $in: query.priority }
  if (query.tag.length) filter['content.tags'] = { $all: query.tag }
  if (typeof query.from === 'number' || typeof query.to === 'number') {
    const range: Record<string, number> = {}
    if (typeof query.from === 'number') range.$gte = query.from
    if (typeof query.to === 'number') range.$lte = query.to
    filter['meta.timestamp'] = range
  }

  return filter
}

export async function listNotices(query: NoticeQuery, scope: Scope): Promise<Paginated<NoticeSummaryDto>> {
  await dbConnect()
  const filter = buildFilter(query)
  const sort: Record<string, 1 | -1> =
    query.sort === 'oldest' ? { 'meta.timestamp': 1 } : { 'meta.timestamp': -1 }
  // 列表不返回正文与互动数据，避免无意义的传输与内存占用。
  const projection = scope === 'public' ? { 'content.body': 0, extra: 0, interaction: 0 } : { interaction: 0 }

  const [docs, total] = await Promise.all([
    Notice.find(filter, projection)
      .sort(sort)
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .lean<INotice[]>(),
    Notice.countDocuments(filter),
  ])

  return {
    items: docs.map(toNoticeSummary),
    total,
    page: query.page,
    pageSize: query.pageSize,
  }
}

async function findNeighbor(
  timestamp: number,
  direction: 'older' | 'newer',
): Promise<{ id: string; title: string } | null> {
  const condition = direction === 'older' ? { $lt: timestamp } : { $gt: timestamp }
  const sort = direction === 'older' ? -1 : 1
  const doc = await Notice.findOne({ 'meta.timestamp': condition }, { 'content.title': 1, 'meta.timestamp': 1 })
    .sort({ 'meta.timestamp': sort as 1 | -1 })
    .lean<Pick<INotice, '_id' | 'content'> | null>()

  if (!doc) return null
  return { id: String(doc._id), title: doc.content.title }
}

async function loadAttachments(ids: string[]): Promise<NoticeAttachmentDto[]> {
  if (ids.length === 0) return []
  const validIds = ids.filter((id) => isValidObjectId(id))
  if (validIds.length === 0) return []

  const { Media } = await import('../models/media')
  const docs = await Media.find({ _id: { $in: validIds } }, { name: 1, format: 1 })
    .lean<{ _id: unknown; name?: string; format: string }[]>()

  const map = new Map(docs.map((doc) => [String(doc._id), doc]))
  return ids
    .map((id) => map.get(id))
    .filter((doc): doc is { _id: unknown; name?: string; format: string } => Boolean(doc))
    .map((doc) => ({ id: String(doc._id), name: doc.name ?? '', format: doc.format }))
}

export async function getNoticeDetail(id: string, scope: Scope): Promise<NoticeDetailResponse> {
  await dbConnect()
  const doc = await Notice.findById(id).lean<INotice | null>()
  if (!doc) throw notFound('文章不存在')

  const [prev, next, attachments] = await Promise.all([
    findNeighbor(doc.meta.timestamp, 'older'),
    findNeighbor(doc.meta.timestamp, 'newer'),
    loadAttachments(doc.content.entities ?? []),
  ])

  return { ...toNoticeDetail(doc, scope), prev, next, attachments }
}

export async function getChannelStats(): Promise<ChannelStat[]> {
  await dbConnect()
  const rows = await Notice.aggregate<{ _id: string; count: number }>([
    { $group: { _id: '$meta.channel', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: 100 },
  ])
  return rows.map((row) => ({ channel: row._id, count: row.count }))
}

export async function getTagStats(limit = 60): Promise<TagStat[]> {
  await dbConnect()
  const rows = await Notice.aggregate<{ _id: string; count: number }>([
    { $unwind: '$content.tags' },
    { $group: { _id: '$content.tags', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: limit },
  ])
  return rows.map((row) => ({ tag: row._id, count: row.count }))
}

function normalizeTags(tags: string[] | undefined): string[] | undefined {
  if (tags === undefined) return undefined
  const unique = Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)))
  return unique.slice(0, 8)
}

function normalizeIds(ids: string[] | undefined): string[] | undefined {
  if (ids === undefined) return undefined
  return Array.from(new Set(ids.filter((id) => isValidObjectId(id))))
}

export async function createNotice(input: NoticeInput): Promise<INotice> {
  await dbConnect()
  const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000)
  const body = input.body ?? ''

  const doc = await Notice.create({
    meta: {
      type: 'article',
      channel: input.channel,
      priority: input.priority,
      timestamp,
    },
    content: {
      title: input.title,
      summary: input.summary?.trim() || deriveSummary(body),
      body,
      author: input.author,
      cover: input.cover ?? '',
      tags: normalizeTags(input.tags) ?? [],
      entities: normalizeIds(input.entities) ?? [],
    },
    interaction: { views: [], likes: [], comments: [] },
    extra: input.extra,
  })

  return doc.toObject() as INotice
}

export async function updateNotice(id: string, input: NoticeUpdateInput): Promise<INotice> {
  await dbConnect()
  const existing = await Notice.findById(id).lean<INotice | null>()
  if (!existing) throw notFound('文章不存在')

  const patch: Record<string, unknown> = {}
  if (input.channel !== undefined) patch['meta.channel'] = input.channel
  if (input.priority !== undefined) patch['meta.priority'] = input.priority
  if (input.timestamp !== undefined) patch['meta.timestamp'] = input.timestamp
  if (input.title !== undefined) patch['content.title'] = input.title
  if (input.body !== undefined) patch['content.body'] = input.body
  if (input.author !== undefined) patch['content.author'] = input.author
  if (input.cover !== undefined) patch['content.cover'] = input.cover
  if (input.extra !== undefined) patch.extra = input.extra
  if (input.tags !== undefined) patch['content.tags'] = normalizeTags(input.tags) ?? []
  if (input.entities !== undefined) patch['content.entities'] = normalizeIds(input.entities) ?? []

  if (input.summary !== undefined) {
    patch['content.summary'] = input.summary.trim() || deriveSummary(input.body ?? existing.content.body ?? '')
  } else if (input.body !== undefined && !existing.content.summary) {
    patch['content.summary'] = deriveSummary(input.body)
  }

  const doc = await Notice.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean<INotice | null>()
  if (!doc) throw notFound('文章不存在')
  return doc
}

export async function deleteNotice(id: string): Promise<void> {
  await dbConnect()
  const result = await Notice.deleteOne({ _id: id })
  if (result.deletedCount === 0) throw notFound('文章不存在')
}

export async function deleteNotices(ids: string[]): Promise<number> {
  await dbConnect()
  const validIds = ids.filter((id) => isValidObjectId(id))
  if (validIds.length === 0) return 0
  const result = await Notice.deleteMany({ _id: { $in: validIds } })
  return result.deletedCount ?? 0
}

export interface MediaReference {
  id: string
  title: string
}

export async function findMediaReferences(mediaId: string): Promise<MediaReference[]> {
  await dbConnect()
  const docs = await Notice.find(
    {
      $or: [
        { 'content.cover': mediaId },
        { 'content.entities': mediaId },
        { 'content.author.avatar': mediaId },
      ],
    },
    { 'content.title': 1 },
  )
    .limit(20)
    .lean<Pick<INotice, '_id' | 'content'>[]>()

  return docs.map((doc) => ({ id: String(doc._id), title: doc.content.title }))
}
