// lib/shared/notice-query.ts
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  NOTICE_PRIORITIES,
  type NoticePriority,
} from './constants'

export type NoticeSort = 'newest' | 'oldest'

export interface NoticeQuery {
  q: string
  channel: string[]
  priority: NoticePriority[]
  tag: string[]
  from?: number
  to?: number
  sort: NoticeSort
  page: number
  pageSize: number
}

export const EMPTY_NOTICE_QUERY: NoticeQuery = {
  q: '',
  channel: [],
  priority: [],
  tag: [],
  sort: 'newest',
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
}

function toPositiveInt(value: string | null, fallback: number, max: number): number {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) return fallback
  return Math.min(parsed, max)
}

function toSeconds(value: string | null): number | undefined {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : undefined
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

export function parseNoticeQuery(params: URLSearchParams): NoticeQuery {
  const priorityValues = params.getAll('priority')
  const priority = NOTICE_PRIORITIES.filter((item) => priorityValues.includes(item))

  return {
    q: (params.get('q') ?? '').trim().slice(0, 80),
    channel: uniqueStrings(params.getAll('channel')),
    priority,
    tag: uniqueStrings(params.getAll('tag')),
    from: toSeconds(params.get('from')),
    to: toSeconds(params.get('to')),
    sort: params.get('sort') === 'oldest' ? 'oldest' : 'newest',
    page: toPositiveInt(params.get('page'), 1, Number.MAX_SAFE_INTEGER),
    pageSize: toPositiveInt(params.get('pageSize'), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  }
}

export function serializeNoticeQuery(query: NoticeQuery): string {
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  for (const channel of query.channel) params.append('channel', channel)
  for (const priority of query.priority) params.append('priority', priority)
  for (const tag of query.tag) params.append('tag', tag)
  if (typeof query.from === 'number') params.set('from', String(query.from))
  if (typeof query.to === 'number') params.set('to', String(query.to))
  if (query.sort !== 'newest') params.set('sort', query.sort)
  if (query.page > 1) params.set('page', String(query.page))
  if (query.pageSize !== DEFAULT_PAGE_SIZE) params.set('pageSize', String(query.pageSize))
  return params.toString()
}

export function toRequestParams(query: NoticeQuery): Record<string, string | string[]> {
  const params: Record<string, string | string[]> = {}
  if (query.q) params.q = query.q
  if (query.channel.length) params.channel = query.channel
  if (query.priority.length) params.priority = query.priority
  if (query.tag.length) params.tag = query.tag
  if (typeof query.from === 'number') params.from = String(query.from)
  if (typeof query.to === 'number') params.to = String(query.to)
  params.sort = query.sort
  params.page = String(query.page)
  params.pageSize = String(query.pageSize)
  return params
}
