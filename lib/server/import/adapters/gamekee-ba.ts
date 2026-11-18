// lib/server/import/adapters/gamekee-ba.ts
import 'server-only'
import { badRequest, upstreamError } from '@/lib/server/errors'
import type { NoticeInput } from '@/lib/shared/contracts/notice'
import { attachNoticeMedia } from '../media'
import type { ImportAdapter, ImportSource } from '../registry'

const CHANNEL = 'ba'
const AUTHOR_NAME = '蔚蓝档案'
const GAME_NAME = '蔚蓝档案'
const ENDPOINT = 'https://www.gamekee.com/v1/activity/page-list'
const GAME_ALIAS = 'ba'
const LANG = 'zh-cn'
// 日常增量只拉最近 50 条，首次全量由脚本显式传入上限
const DEFAULT_LIMIT = 50
// 接口单次最多返回 999 条，全量要按页翻完
const PAGE_SIZE = 100
const MAX_LIMIT = 5000
const MAX_PAGES = 60
// GameKee 图床校验来源页，媒体代理需要带上
const REFERER = 'https://www.gamekee.com/'
const FETCH_TIMEOUT_MS = 20_000
const MAX_TITLE_LENGTH = 200
const MAX_SUMMARY_LENGTH = 300
const MAX_TAG_LENGTH = 30
const MAX_BODY_LENGTH = 500_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function toInt(value: unknown): number | undefined {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isInteger(num) || num < 0) return undefined
  return num
}

// 接口描述里夹带 BOM 与换行，落库前统一压成单行
function normalizeText(value: unknown, limit: number): string {
  return toText(value)
    .replace(/\uFEFF/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, limit)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// 图片地址是协议相对写法，补成 https 才能被媒体代理抓取
function normalizeImage(value: string): string {
  const url = toText(value)
  if (!url) return ''
  if (url.startsWith('//')) return `https:${url}`
  return /^https?:\/\//i.test(url) ? url : ''
}

function formatDate(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(0, 10)
}

interface ActivityPage {
  items: Record<string, unknown>[]
  total: number
  pageTotal: number
}

async function fetchPage(pageNo: number, limit: number): Promise<ActivityPage> {
  const url = `${ENDPOINT}?sort=-1&limit=${limit}&page_no=${pageNo}`
  let response: Response
  try {
    response = await fetch(url, {
      cache: 'no-store',
      headers: { 'game-alias': GAME_ALIAS, lang: LANG, accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  } catch {
    throw upstreamError('请求 GameKee 活动列表失败')
  }
  if (!response.ok) throw upstreamError(`GameKee 活动列表返回 ${response.status}`)

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw upstreamError('GameKee 活动列表响应不是合法 JSON')
  }
  // 业务错误同样返回 200，需要检查业务码
  if (!isRecord(payload) || toInt(payload.code) !== 0) {
    const message = isRecord(payload) ? toText(payload.msg) || '未知错误' : '未知错误'
    throw upstreamError(`GameKee 活动列表业务错误：${message}`)
  }

  const meta = isRecord(payload.meta) && isRecord(payload.meta.pagination) ? payload.meta.pagination : {}
  return {
    items: Array.isArray(payload.data) ? payload.data.filter(isRecord) : [],
    total: toInt(meta.total) ?? 0,
    pageTotal: toInt(meta.page_total) ?? 0,
  }
}

// 按页拉取直到取够 limit 条或翻完；接口单页上限 999，翻页才能真正覆盖全量
async function fetchActivities(limit: number): Promise<Record<string, unknown>[]> {
  const collected: Record<string, unknown>[] = []
  const pageSize = Math.min(limit, PAGE_SIZE)

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await fetchPage(page, pageSize)
    collected.push(...result.items)

    if (result.items.length < pageSize) break
    if (collected.length >= limit) break
    if (result.pageTotal > 0 && page >= result.pageTotal) break
  }

  return collected.slice(0, limit)
}

function toNoticeInput(item: Record<string, unknown>): Record<string, unknown> {
  const title = normalizeText(item.title, MAX_TITLE_LENGTH)
  const area = normalizeText(item.pub_area, MAX_TAG_LENGTH)
  const kind = normalizeText(item.activity_kind_name, MAX_TAG_LENGTH)
  const begin = toInt(item.begin_at)
  const end = toInt(item.end_at)
  const link = toText(item.link_url)
  const picture = normalizeImage(toText(item.picture))
  const description = toText(item.description).replace(/\uFEFF/g, '')
  const id = toInt(item.id)

  // 区服组合成「蔚蓝档案·日服」，活动类别单独成一个标签
  const tags: string[] = []
  if (area) tags.push(`${GAME_NAME}·${area}`)
  if (kind) tags.push(kind)

  const range =
    begin !== undefined && end !== undefined
      ? `${formatDate(begin)} - ${formatDate(end)}`
      : begin !== undefined
        ? `${formatDate(begin)} 起`
        : ''
  const summary = description
    ? normalizeText(description, MAX_SUMMARY_LENGTH)
    : range
      ? `活动时间：${range}`
      : ''

  const paragraphs: string[] = []
  if (range) paragraphs.push(`<p>活动时间：${range}</p>`)
  for (const line of description.split(/\r?\n/)) {
    const text = line.replace(/\uFEFF/g, '').trim()
    if (text) paragraphs.push(`<p>${escapeHtml(text)}</p>`)
  }
  if (/^https?:\/\//i.test(link)) {
    paragraphs.push(`<p><a href="${escapeHtml(link)}">查看活动详情</a></p>`)
  }
  const body = paragraphs.join('').slice(0, MAX_BODY_LENGTH)

  const extra: Record<string, unknown> = { source: 'gamekee-ba' }
  if (id !== undefined) extra.cid = String(id)
  if (area) extra.pub_area = area
  if (kind) extra.activity_kind_name = kind
  const kindId = toInt(item.activity_kind_id)
  if (kindId !== undefined) extra.activity_kind_id = kindId
  const state = toInt(item.activity_state)
  if (state !== undefined) extra.activity_state = state
  if (begin !== undefined) extra.begin_at = begin
  if (end !== undefined) extra.end_at = end
  if (/^https?:\/\//i.test(link)) extra.link_url = link

  const notice: Record<string, unknown> = {
    channel: CHANNEL,
    priority: 'normal',
    title,
    author: { name: AUTHOR_NAME },
    tags,
    extra,
  }
  if (begin !== undefined) notice.timestamp = begin
  if (summary) notice.summary = summary
  if (body) notice.body = body
  // 封面先保留原始地址，导入写入时再登记成媒体
  if (picture) notice.cover = picture
  return notice
}

export async function fetchGamekeeActivities(limit = DEFAULT_LIMIT): Promise<unknown[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT)
  const items = await fetchActivities(safeLimit)
  return items.map(toNoticeInput)
}

export const gamekeeBaImportAdapter: ImportAdapter = {
  id: 'gamekee-ba',
  label: '蔚蓝档案活动（GameKee）',
  accepts: [],
  remote: true,
  description: '实时读取 GameKee 活动列表，默认最近 50 条；全量用 npm run import:gamekee-ba（按页翻完）',

  async parse(source?: ImportSource): Promise<unknown[]> {
    if (source) throw badRequest('该适配器直接读取 GameKee 接口，无需上传文件')
    return fetchGamekeeActivities()
  },

  async materialize(payload: NoticeInput[]): Promise<NoticeInput[]> {
    return attachNoticeMedia(payload, {
      author: { name: AUTHOR_NAME },
      warningLabel: '[import:gamekee-ba]',
      referer: REFERER,
    })
  },
}