// lib/server/import/adapters/zmd-web.ts
import 'server-only'
import { badRequest, upstreamError } from '@/lib/server/errors'
import type { NoticeInput } from '@/lib/shared/contracts/notice'
import { attachNoticeMedia } from '../media'
import type { ImportAdapter, ImportParseOptions, ImportSource } from '../registry'

const CHANNEL = 'zmd'
const AUTHOR_NAME = '终末地·游戏'
const TAG = '终末地·官网'
const ENDPOINT = 'https://web-news.hypergryph.com/api/bulletin'
const GAME_CODE = 'endfield_web'
const LANG = 'zh-cn'
const PAGE_SIZE = 20
// 翻页上限，防止上游 total 异常时无限请求
const MAX_PAGES = 20
const DETAIL_CONCURRENCY = 6
const FETCH_TIMEOUT_MS = 15_000
const MAX_TITLE_LENGTH = 200
const MAX_SUMMARY_LENGTH = 300

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

function normalizeText(value: unknown, limit: number): string {
  return toText(value)
    .replace(/\\n/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, limit)
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

async function fetchJson(url: string, label: string): Promise<Record<string, unknown>> {
  let response: Response
  try {
    response = await fetch(url, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  } catch {
    throw upstreamError(`请求${label}失败`)
  }
  if (!response.ok) throw upstreamError(`${label}返回 ${response.status}`)

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw upstreamError(`${label}响应不是合法 JSON`)
  }
  // 业务错误同样返回 200，需要检查业务码
  if (!isRecord(payload) || toInt(payload.code) !== 0) {
    const message = isRecord(payload) ? toText(payload.msg) || '未知错误' : '未知错误'
    throw upstreamError(`${label}业务错误：${message}`)
  }
  return isRecord(payload.data) ? payload.data : {}
}

async function fetchList(): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = []
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const data = await fetchJson(
      `${ENDPOINT}?lang=${LANG}&code=${GAME_CODE}&page=${page}&pageSize=${PAGE_SIZE}`,
      '官网公告列表',
    )
    const list = Array.isArray(data.list) ? data.list.filter(isRecord) : []
    items.push(...list)
    const total = toInt(data.total)
    if (list.length === 0) break
    if (total !== undefined && items.length >= total) break
  }
  return items
}

async function fetchDetailHtml(cid: string): Promise<string> {
  const data = await fetchJson(
    `${ENDPOINT}/${encodeURIComponent(cid)}?lang=${LANG}&code=${GAME_CODE}`,
    `官网公告详情（${cid}）`,
  )
  return toText(data.data)
}

function toNoticeInput(item: Record<string, unknown>, html: string): Record<string, unknown> {
  const title = normalizeText(item.title, MAX_TITLE_LENGTH)
  const summary = normalizeText(item.brief, MAX_SUMMARY_LENGTH)
  const timestamp = toInt(item.displayTime)
  const cover = toText(item.cover)
  const cid = toText(item.cid)
  const tab = toText(item.tab)
  // sticky 即官网列表置顶，只记录到 extra，优先级统一普通
  const sticky = item.sticky === true

  const extra: Record<string, unknown> = { source: 'zmd-web' }
  if (cid) extra.cid = cid
  if (tab) extra.tab = tab
  if (sticky) extra.sticky = true

  const notice: Record<string, unknown> = {
    channel: CHANNEL,
    priority: 'normal',
    title,
    author: { name: AUTHOR_NAME },
    tags: [TAG],
    extra,
  }
  if (timestamp !== undefined) notice.timestamp = timestamp
  if (summary) notice.summary = summary
  if (html) notice.body = html
  // 封面先保留原始地址，导入写入时再登记成媒体
  if (/^https?:\/\//i.test(cover)) notice.cover = cover
  return notice
}

export const zmdWebImportAdapter: ImportAdapter = {
  id: 'zmd-web',
  label: '终末地官网公告',
  accepts: [],
  remote: true,
  description: '实时拉取 web-news 的公告列表，并逐条请求详情补充正文；标签固定为「终末地·官网」',

  async parse(source?: ImportSource, options?: ImportParseOptions): Promise<unknown[]> {
    if (source) throw badRequest('该适配器直接读取官网接口，无需上传文件')

    const items = await fetchList()
    if (items.length === 0) throw upstreamError('官网公告列表为空')

    const skip = new Set(options?.skipCids ?? [])
    const limit = options?.limit && options.limit > 0 ? Math.trunc(options.limit) : items.length
    // 官网列表把置顶公告排在前面，按发布时间倒序后只抓未入库的最近 limit 条详情
    const picked = items
      .filter((item) => {
        const cid = toText(item.cid)
        return !cid || !skip.has(cid)
      })
      .sort((a, b) => (toInt(b.displayTime) ?? 0) - (toInt(a.displayTime) ?? 0))
      .slice(0, limit)

    if (picked.length === 0) return []

    const run = createLimiter(DETAIL_CONCURRENCY)
    const notices = await Promise.all(
      picked.map((item) =>
        run(async () => {
          const cid = toText(item.cid)
          const html = cid
            ? await fetchDetailHtml(cid).catch((error: unknown) => {
                // 单条详情失败只丢正文，列表摘要仍可导入
                console.warn('[import:zmd-web] 公告详情获取失败，仅导入列表摘要', cid, error)
                return ''
              })
            : ''
          return toNoticeInput(item, html)
        }),
      ),
    )
    return notices
  },

  async materialize(payload: NoticeInput[]): Promise<NoticeInput[]> {
    return attachNoticeMedia(payload, {
      author: { name: AUTHOR_NAME },
      warningLabel: '[import:zmd-web]',
    })
  },
}
