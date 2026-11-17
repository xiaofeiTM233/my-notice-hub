// lib/server/import/adapters/zmd.ts
import 'server-only'
import { badRequest, upstreamError } from '@/lib/server/errors'
import type { NoticeInput } from '@/lib/shared/contracts/notice'
import { attachNoticeMedia } from '../media'
import type { ImportAdapter, ImportSource } from '../registry'

const CHANNEL = 'zmd'
const AUTHOR_NAME = '终末地·游戏'
const ENDPOINT = 'https://game-hub.hypergryph.com/bulletin/v2/aggregate'
// 终末地游戏标识码，接口缺失或非法时返回 code=1500
const GAME_CODE = 'endfield_5SD9TN'
// 活动公告 / 游戏公告 / 资讯速报三个频道合并导入
const BULLETIN_TYPES = [0, 1, 2]
const FETCH_TIMEOUT_MS = 15_000

// 接口 tab 与频道语义一一对应，落成标签便于后台按公告类别筛选。
const TAB_TAG: Record<string, string> = {
  events: '活动公告',
  news: '资讯速报',
  updates: '游戏公告',
  cloud: '云端',
}

// 递归扫描导出文件时的深度上限，避免异常结构导致无限下探。
const MAX_SCAN_DEPTH = 8
const MAX_TITLE_LENGTH = 200
const MAX_SUMMARY_LENGTH = 300
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

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// 接口用换行控制标题两行展示，落库压成单行，避免列表卡片排版错位。
function normalizeTitle(value: unknown): string {
  return toText(value)
    .replace(/\\n/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, MAX_TITLE_LENGTH)
}

function richText(item: Record<string, unknown>): string {
  return isRecord(item.data) ? toText(item.data.html) : ''
}

function collectBulletins(
  node: unknown,
  depth: number,
  out: Map<string, Record<string, unknown>>,
): void {
  if (depth > MAX_SCAN_DEPTH) return
  if (Array.isArray(node)) {
    node.forEach((item) => collectBulletins(item, depth + 1, out))
    return
  }
  if (!isRecord(node)) return

  const cid = toText(node.cid)
  // 不同 type 的响应可同时存在于一个文件里，按 cid 去重并保留带正文的版本。
  if (cid && typeof node.title === 'string') {
    const existing = out.get(cid)
    if (!existing || (!richText(existing) && richText(node))) out.set(cid, node)
  }

  Object.values(node).forEach((value) => collectBulletins(value, depth + 1, out))
}

function pictureBody(url: string, title: string, link: string): string {
  const image = `<p><img src="${escapeAttr(url)}" alt="${escapeAttr(title)}" /></p>`
  if (!/^https?:\/\//i.test(link)) return image
  return `${image}<p><a href="${escapeAttr(link)}">查看活动详情</a></p>`
}

// 公告条目映射为文章输入；正文缺 html 的条目仍保留，交由上层校验暴露缺字段。
function toNoticeInput(item: Record<string, unknown>): Record<string, unknown> {
  const title = normalizeTitle(item.title)
  const data = isRecord(item.data) ? item.data : {}
  const displayType = toText(item.displayType)
  const pictureUrl = toText(data.url)
  const pictureLink = toText(data.link)

  const tab = toText(item.tab)
  const tabTag = TAB_TAG[tab]
  const header = toText(item.header)
  const timestamp = toInt(item.startAt)
  const body =
    displayType === 'picture' && pictureUrl
      ? pictureBody(pictureUrl, title, pictureLink)
      : richText(item).slice(0, MAX_BODY_LENGTH)

  const extra: Record<string, unknown> = { source: 'zmd' }
  const cid = toText(item.cid)
  if (cid) extra.cid = cid
  if (tab) extra.tab = tab
  if (displayType) extra.displayType = displayType
  const type = toInt(item.type)
  if (type !== undefined) extra.type = type
  const linkType = toInt(data.linkType)
  if (linkType !== undefined) extra.linkType = linkType

  const notice: Record<string, unknown> = {
    channel: CHANNEL,
    // 接口的 focus 即焦点推荐位，对应后台的高优先级。
    priority: toInt(item.focus) === 1 ? 'high' : 'normal',
    title,
    author: { name: AUTHOR_NAME },
    tags: tabTag ? [tabTag] : [],
    extra,
  }
  if (timestamp !== undefined) notice.timestamp = timestamp
  if (body) notice.body = body
  if (header && header !== title) notice.summary = header.slice(0, MAX_SUMMARY_LENGTH)
  return notice
}

export const zmdImportAdapter: ImportAdapter = {
  id: 'zmd',
  label: '终末地公告聚合接口',
  accepts: ['application/json', '.json'],
  remote: true,
  description: '不选文件时实时请求 game-hub 的 0/1/2 频道；也可上传接口响应 JSON 离线导入',

  async parse(source?: ImportSource): Promise<unknown[]> {
    const raws = source ? [parseFile(source)] : await fetchBulletins()
    const bulletins = new Map<string, Record<string, unknown>>()
    raws.forEach((raw) => collectBulletins(raw, 0, bulletins))
    if (bulletins.size === 0) {
      throw badRequest('未找到公告条目，请确认数据包含 data.list 或公告条目数组')
    }
    return Array.from(bulletins.values()).map(toNoticeInput)
  },

  async materialize(payload: NoticeInput[]): Promise<NoticeInput[]> {
    return attachNoticeMedia(payload, {
      author: { name: AUTHOR_NAME },
      warningLabel: '[import:zmd]',
      coverFromBody: (notice) => notice.extra?.displayType === 'picture',
    })
  },
}

function parseFile(source: ImportSource): unknown {
  const text = source.buffer.toString('utf8').replace(/^\uFEFF/, '')
  try {
    return JSON.parse(text)
  } catch {
    throw badRequest('文件不是合法 JSON，请上传 /bulletin/v2/aggregate 的响应导出')
  }
}

async function fetchAggregate(type: number): Promise<unknown> {
  const url = `${ENDPOINT}?code=${GAME_CODE}&type=${type}&hideDetail=0`
  let response: Response
  try {
    response = await fetch(url, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  } catch {
    throw upstreamError(`请求公告接口失败（type=${type}）`)
  }
  if (!response.ok) throw upstreamError(`公告接口返回 ${response.status}（type=${type}）`)

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw upstreamError(`公告接口响应不是合法 JSON（type=${type}）`)
  }
  // 业务错误同样返回 200，需要检查业务码
  if (isRecord(payload) && toInt(payload.code) !== 0) {
    throw upstreamError(`公告接口业务错误：${toText(payload.msg) || '未知错误'}（type=${type}）`)
  }
  return payload
}

async function fetchBulletins(): Promise<unknown[]> {
  return Promise.all(BULLETIN_TYPES.map((type) => fetchAggregate(type)))
}
