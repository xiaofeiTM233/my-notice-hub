// lib/server/mcp/tools.ts
import 'server-only'
import { encode } from 'next-auth/jwt'
import dbConnect from '@/lib/db'
import { badRequest } from '@/lib/server/errors'
import { requireAdmin } from '@/lib/server/guard'
import { verifyPassword, hashPassword } from '@/lib/server/auth-password'
import { getSetting, clearSettingCache } from '@/lib/server/setting-store'
import { rateLimit, resetRateLimit } from '@/lib/server/rate-limit'
import {
  createNotice,
  deleteNotice,
  deleteNotices,
  findMediaReferences,
  getChannelStats,
  getNoticeDetail,
  getTagStats,
  listNotices,
  updateNotice,
} from '@/lib/server/queries/notice'
import { toMediaDto, toNoticeDetail, toSettingDto } from '@/lib/server/dto'
import {
  formatFromFilename,
  hashBuffer,
  removeMedia,
  saveMedia,
} from '@/lib/media'
import { Media, type IMedia } from '@/lib/server/models/media'
import { Notice } from '@/lib/server/models/notice'
import { ImportJob } from '@/lib/server/models/import-job'
import { Setting } from '@/lib/server/models/setting'
import { commitPayload } from '@/lib/server/import/commit'
import { getImportAdapter, listImportAdapters } from '@/lib/server/import/registry'
import { noticeInputSchema, noticeUpdateSchema, noticeQuerySchema } from '@/lib/shared/contracts/notice'
import { settingsPatchSchema, passwordChangeSchema } from '@/lib/shared/contracts/settings'
import { importCommitSchema } from '@/lib/shared/contracts/import'
import {
  LOGIN_RATE_LIMIT,
  LOGIN_RATE_WINDOW_MS,
  SESSION_MAX_AGE_SECONDS,
  STORAGE_CREDENTIAL_KEYS,
  UPLOAD_MAX_BYTES,
} from '@/lib/shared/constants'
import { parseNoticeQuery } from '@/lib/shared/notice-query'

export interface McpToolResult {
  content: { type: 'text'; text: string }[]
  structuredContent?: unknown
  isError?: boolean
}

export interface McpTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  readOnly: boolean
  // login 是唯一允许在未登录时调用的工具，其余工具都要求管理员会话 Cookie。
  public: boolean
  handler: (args: Record<string, unknown>, request: Request) => Promise<unknown>
}

function text(value: unknown, isError = false): McpToolResult {
  const payload = { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] }
  return isError ? { ...payload, isError: true } : { ...payload, structuredContent: value }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw badRequest(`${field} 必须是对象`)
  }
  return value as Record<string, unknown>
}

// 列表查询参数从扁平对象还原成 noticeQuerySchema 需要的形状，重复传数组即多选。
function noticeQueryFromArgs(args: Record<string, unknown>) {
  const toList = (value: unknown): string[] => {
    if (value === undefined || value === null) return []
    if (Array.isArray(value)) return value.map((item) => String(item))
    return [String(value)]
  }
  const params = new URLSearchParams()
  if (args.q !== undefined) params.set('q', String(args.q))
  for (const channel of toList(args.channel)) params.append('channel', channel)
  for (const priority of toList(args.priority)) params.append('priority', priority)
  for (const tag of toList(args.tag)) params.append('tag', tag)
  if (args.from !== undefined) params.set('from', String(args.from))
  if (args.to !== undefined) params.set('to', String(args.to))
  if (args.sort !== undefined) params.set('sort', String(args.sort))
  if (args.page !== undefined) params.set('page', String(args.page))
  if (args.pageSize !== undefined) params.set('pageSize', String(args.pageSize))
  return noticeQuerySchema.parse(parseNoticeQuery(params))
}

// 按 id 或标题定位文章，标题必须唯一命中，避免误改。
async function resolveNotice(idOrTitle: string): Promise<string> {
  const target = idOrTitle.trim()
  if (!target) throw badRequest('缺少文章 id 或标题')
  if (/^[0-9a-fA-F]{24}$/.test(target)) return target

  await dbConnect()
  const hits = await Notice.find(
    { 'content.title': target },
    { _id: 1, 'content.title': 1 },
  )
    .limit(5)
    .lean<{ _id: unknown; content: { title: string } }[]>()

  if (hits.length === 0) throw badRequest(`找不到标题为「${target}」的文章`)
  if (hits.length > 1) {
    throw badRequest(
      `标题「${target}」匹配到 ${hits.length} 篇，请改用 id：${hits
        .map((hit) => String(hit._id))
        .join('、')}`,
    )
  }
  return String(hits[0]._id)
}

export const MCP_TOOLS: McpTool[] = [
  {
    name: 'login',
    description:
      '用管理员账号密码登录，返回可直接使用的 Auth.js 会话 Cookie。本工具无需 Cookie，其余工具都必须带 Cookie。把返回的 cookie 字段原样作为请求头 Cookie 传给 /api/mcp 即可。会话有效期 12 小时，改密后立即失效。',
    inputSchema: {
      type: 'object',
      properties: {
        username: { type: 'string', description: '管理员用户名' },
        password: { type: 'string', description: '管理员密码' },
      },
      required: ['username', 'password'],
      additionalProperties: false,
    },
    readOnly: false,
    public: true,
    handler: async (args) => {
      const username = String(args.username ?? '').trim()
      const password = String(args.password ?? '')
      if (!username || !password) throw badRequest('用户名和密码都不能为空')

      const limitKey = `login:${username.toLowerCase()}`
      if (!rateLimit(limitKey, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW_MS)) {
        throw badRequest('登录尝试过于频繁，请稍后再试')
      }

      const setting = await getSetting()
      if (username !== setting.admin.username) throw badRequest('用户名或密码不正确')
      if (!verifyPassword(password, setting.admin.passwordHash, setting.admin.passwordSalt)) {
        throw badRequest('用户名或密码不正确')
      }
      resetRateLimit(limitKey)

      // 按 Auth.js 的 JWT 格式签发，字段与 auth.ts 的 jwt 回调一致，requireAdmin 可直接识别。
      const secret = process.env.AUTH_SECRET
      if (!secret) throw badRequest('服务端未配置 AUTH_SECRET，无法签发会话')
      const maxAge = SESSION_MAX_AGE_SECONDS
      const now = Math.floor(Date.now() / 1000)
      const cookieName = 'authjs.session-token'

      const token = await encode({
        token: {
          name: username,
          sub: 'admin',
          username,
          sv: setting.admin.sessionVersion,
          iat: now,
          exp: now + maxAge,
        },
        secret,
        salt: cookieName,
        maxAge,
      })

      return {
        cookie: `${cookieName}=${token}`,
        cookieName,
        expiresAt: now + maxAge,
        username,
        usage: '后续请求加请求头 Cookie: <cookie>',
        note: 'HTTPS 部署时 Cookie 名带 __Secure- 前缀，请以登录响应下发的 Set-Cookie 为准',
      }
    },
  },
  {
    name: 'whoami',
    description: '校验当前会话是否有效，返回当前登录的管理员用户名。适合调用其他工具前先确认登录状态。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    readOnly: true,
    public: false,
    handler: async () => {
      const session = await requireAdmin()
      return { username: session.user?.name ?? 'admin', authenticated: true }
    },
  },
  {
    name: 'list_notices',
    description:
      '分页查询文章列表，返回摘要（不含正文）。筛选条件之间是 AND 关系；channel 与 priority 传数组表示多选任一命中，tag 传数组要求全部命中。',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: '标题或摘要关键词，≤ 80 字' },
        channel: {
          type: 'array',
          items: { type: 'string' },
          description: '频道名，多选任一命中',
        },
        priority: {
          type: 'array',
          items: { type: 'string', enum: ['urgent', 'high', 'normal', 'low'] },
          description: '优先级，多选任一命中',
        },
        tag: {
          type: 'array',
          items: { type: 'string' },
          description: '标签，要求同时命中全部标签',
        },
        from: { type: 'integer', description: '发布时间下界（Unix 秒，闭区间）' },
        to: { type: 'integer', description: '发布时间上界（Unix 秒，闭区间）' },
        sort: { type: 'string', enum: ['newest', 'oldest'], description: '排序方向，默认 newest' },
        page: { type: 'integer', description: '页码，从 1 开始，默认 1' },
        pageSize: { type: 'integer', description: '每页条数，默认 12，上限 60' },
      },
      additionalProperties: false,
    },
    readOnly: true,
    public: false,
    handler: async (args) => listNotices(noticeQueryFromArgs(args), 'admin'),
  },
  {
    name: 'get_notice',
    description: '按 id 或唯一标题读取文章详情，含正文、附件明细与前后篇。',
    inputSchema: {
      type: 'object',
      properties: {
        idOrTitle: { type: 'string', description: '文章 id（24 位十六进制）或唯一标题' },
      },
      required: ['idOrTitle'],
      additionalProperties: false,
    },
    readOnly: true,
    public: false,
    handler: async (args) => getNoticeDetail(await resolveNotice(String(args.idOrTitle ?? '')), 'admin'),
  },
  {
    name: 'create_notice',
    description:
      '新建文章。title 与 channel 必填；timestamp 省略取当前时间；summary 留空自动截取正文前 120 字。',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '标题，≤ 200 字' },
        channel: { type: 'string', description: '频道名，≤ 60 字' },
        priority: { type: 'string', enum: ['urgent', 'high', 'normal', 'low'], description: '优先级，默认 normal' },
        timestamp: { type: 'integer', description: '发布时间（Unix 秒），省略取当前时间' },
        summary: { type: 'string', description: '摘要，≤ 300 字；留空自动从正文生成' },
        body: { type: 'string', description: '正文，支持 Markdown 或 HTML' },
        author: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '作者名' },
            avatar: { type: 'string', description: '头像地址或媒体 id' },
          },
          description: '作者信息',
        },
        cover: { type: 'string', description: '封面媒体 id' },
        tags: { type: 'array', items: { type: 'string' }, description: '标签，最多 8 个' },
        entities: { type: 'array', items: { type: 'string' }, description: '附件媒体 id 列表' },
        extra: { type: 'object', description: '业务自定义 JSON' },
      },
      required: ['title', 'channel'],
      additionalProperties: false,
    },
    readOnly: false,
    public: false,
    handler: async (args) => {
      const input = noticeInputSchema.parse(args)
      const doc = await createNotice(input)
      return toNoticeDetail(doc, 'admin')
    },
  },
  {
    name: 'update_notice',
    description:
      '局部更新文章。只传要改的字段，未传字段保持不变；summary 传空串会按新正文重新生成。',
    inputSchema: {
      type: 'object',
      properties: {
        idOrTitle: { type: 'string', description: '文章 id 或唯一标题' },
        patch: {
          type: 'object',
          description: '要更新的字段，形状同 create_notice 的可选字段',
          properties: {
            title: { type: 'string', description: '标题' },
            channel: { type: 'string', description: '频道名' },
            priority: { type: 'string', enum: ['urgent', 'high', 'normal', 'low'], description: '优先级' },
            timestamp: { type: 'integer', description: '发布时间（Unix 秒）' },
            summary: { type: 'string', description: '摘要' },
            body: { type: 'string', description: '正文' },
            author: { type: 'object', description: '作者信息' },
            cover: { type: 'string', description: '封面媒体 id' },
            tags: { type: 'array', items: { type: 'string' }, description: '标签' },
            entities: { type: 'array', items: { type: 'string' }, description: '附件媒体 id 列表' },
            extra: { type: 'object', description: '自定义 JSON，整体替换' },
          },
          additionalProperties: false,
        },
      },
      required: ['idOrTitle', 'patch'],
      additionalProperties: false,
    },
    readOnly: false,
    public: false,
    handler: async (args) => {
      const id = await resolveNotice(String(args.idOrTitle ?? ''))
      const patch = noticeUpdateSchema.parse(asRecord(args.patch, 'patch'))
      const doc = await updateNotice(id, patch)
      return toNoticeDetail(doc, 'admin')
    },
  },
  {
    name: 'delete_notice',
    description: '删除单篇文章，不影响其引用的媒体记录。',
    inputSchema: {
      type: 'object',
      properties: {
        idOrTitle: { type: 'string', description: '文章 id 或唯一标题' },
      },
      required: ['idOrTitle'],
      additionalProperties: false,
    },
    readOnly: false,
    public: false,
    handler: async (args) => {
      const id = await resolveNotice(String(args.idOrTitle ?? ''))
      await deleteNotice(id)
      return { deleted: true, id }
    },
  },
  {
    name: 'delete_notices',
    description: '批量删除文章，一次最多 100 个 id，返回实际删除条数。',
    inputSchema: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'string' },
          description: '文章 id 列表，1 到 100 个',
        },
      },
      required: ['ids'],
      additionalProperties: false,
    },
    readOnly: false,
    public: false,
    handler: async (args) => {
      const ids = Array.isArray(args.ids) ? args.ids.map((id) => String(id)) : []
      if (ids.length === 0) throw badRequest('ids 不能为空')
      if (ids.length > 100) throw badRequest('一次最多删除 100 篇')
      const deleted = await deleteNotices(ids)
      return { deleted }
    },
  },
  {
    name: 'list_channels',
    description: '列出全部频道及文章数量，按数量倒序，用于选频道名。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    readOnly: true,
    public: false,
    handler: async () => ({ items: await getChannelStats() }),
  },
  {
    name: 'list_tags',
    description: '列出热门标签及出现次数，按次数倒序，用于选标签。',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: '返回条数上限，默认 60，最大 100' },
      },
      additionalProperties: false,
    },
    readOnly: true,
    public: false,
    handler: async (args) => {
      const raw = Number(args.limit ?? 60)
      const limit = Number.isInteger(raw) && raw > 0 ? Math.min(raw, 100) : 60
      return { items: await getTagStats(limit) }
    },
  },
  {
    name: 'list_media',
    description: '分页查询媒体库，可按名称关键词、存储类型、扩展名过滤，用于复用已有封面与附件。',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: '名称关键词，≤ 80 字' },
        type: {
          type: 'string',
          enum: ['base64', 'url', 'r2', 'vercel', 'webdav', 'edgeone'],
          description: '存储类型',
        },
        format: { type: 'string', description: '扩展名，如 png / pdf' },
        page: { type: 'integer', description: '页码，默认 1' },
        pageSize: { type: 'integer', description: '每页条数，默认 24，上限 60' },
      },
      additionalProperties: false,
    },
    readOnly: true,
    public: false,
    handler: async (args) => {
      const page = Number(args.page ?? 1)
      const pageSize = Number(args.pageSize ?? 24)
      const safePage = Number.isInteger(page) && page > 0 ? page : 1
      const safeSize = Number.isInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, 60) : 24

      await dbConnect()
      const filter: Record<string, unknown> = {}
      if (args.q) filter.name = new RegExp(String(args.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      if (args.type) filter.type = String(args.type)
      if (args.format) filter.format = String(args.format)

      const [docs, total] = await Promise.all([
        Media.find(filter)
          .sort({ _id: -1 })
          .skip((safePage - 1) * safeSize)
          .limit(safeSize)
          .lean<IMedia[]>(),
        Media.countDocuments(filter),
      ])

      return {
        items: docs.map((doc) => toMediaDto(doc)),
        total,
        page: safePage,
        pageSize: safeSize,
      }
    },
  },
  {
    name: 'get_media',
    description: '按 id 读取单条媒体元信息，含引用它的文章列表，删除前可先确认影响面。',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: '媒体 id' } },
      required: ['id'],
      additionalProperties: false,
    },
    readOnly: true,
    public: false,
    handler: async (args) => {
      const id = String(args.id ?? '').trim()
      if (!/^[0-9a-fA-F]{24}$/.test(id)) throw badRequest('媒体 id 格式不正确')
      await dbConnect()
      const doc = await Media.findById(id).lean<IMedia | null>()
      if (!doc) throw badRequest('媒体不存在')
      return { ...toMediaDto(doc), references: await findMediaReferences(id) }
    },
  },
  {
    name: 'upload_media',
    description:
      '上传媒体。content 传 base64 编码的文件内容，服务端按内容哈希去重：命中已有媒体时直接返回该记录并置 deduped 为 true。',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '文件名，扩展名决定存储格式，如 banner.png' },
        content: { type: 'string', description: '文件内容的 base64 编码，不含 data URI 前缀' },
        author: { type: 'string', description: '上传者名称，可选' },
      },
      required: ['name', 'content'],
      additionalProperties: false,
    },
    readOnly: false,
    public: false,
    handler: async (args) => {
      const name = String(args.name ?? '').trim()
      const content = String(args.content ?? '').replace(/^data:[^;]+;base64,/, '')
      if (!name) throw badRequest('缺少文件名')
      if (!content) throw badRequest('缺少文件内容')

      const buffer = Buffer.from(content, 'base64')
      if (buffer.length === 0) throw badRequest('文件内容不是合法的 base64')
      if (buffer.length > UPLOAD_MAX_BYTES) {
        throw badRequest(`文件超过上限 ${Math.floor(UPLOAD_MAX_BYTES / 1024 / 1024)} MB`)
      }

      const authorName = String(args.author ?? '').trim()
      const media = await saveMedia({
        name,
        buffer,
        format: formatFromFilename(name),
        author: authorName ? { name: authorName } : undefined,
      })
      return { ...toMediaDto(media, buffer.length), deduped: media.hash === hashBuffer(buffer) }
    },
  },
  {
    name: 'update_media',
    description: '更新媒体展示名与作者，不影响已存储的字节内容。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '媒体 id' },
        name: { type: 'string', description: '新的展示名，≤ 120 字' },
        author: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '作者名' },
            avatar: { type: 'string', description: '头像地址或媒体 id' },
          },
          description: '作者信息',
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
    readOnly: false,
    public: false,
    handler: async (args) => {
      const id = String(args.id ?? '').trim()
      if (!/^[0-9a-fA-F]{24}$/.test(id)) throw badRequest('媒体 id 格式不正确')

      const patch: Record<string, unknown> = {}
      if (args.name !== undefined) patch.name = String(args.name)
      if (args.author !== undefined) patch.author = asRecord(args.author, 'author')

      await dbConnect()
      const doc = await Media.findByIdAndUpdate(id, { $set: patch }, { returnDocument: 'after' }).lean<IMedia | null>()
      if (!doc) throw badRequest('媒体不存在')
      return toMediaDto(doc)
    },
  },
  {
    name: 'delete_media',
    description:
      '删除媒体。默认先检查文章引用，被引用时返回错误并列出引用文章；force 为 true 时跳过检查强制删除。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '媒体 id' },
        force: { type: 'boolean', description: '为 true 时忽略引用检查强制删除，默认 false' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    readOnly: false,
    public: false,
    handler: async (args) => {
      const id = String(args.id ?? '').trim()
      if (!/^[0-9a-fA-F]{24}$/.test(id)) throw badRequest('媒体 id 格式不正确')
      const force = args.force === true

      await dbConnect()
      const media = await Media.findById(id).lean<IMedia | null>()
      if (!media) throw badRequest('媒体不存在')

      if (!force) {
        const references = await findMediaReferences(id)
        if (references.length > 0) {
          throw badRequest(
            `媒体被 ${references.length} 篇文章引用：${references.map((item) => item.title).join('、')}。确认要删请传 force: true`,
          )
        }
      }

      await removeMedia(media)
      await Media.deleteOne({ _id: id })
      return { deleted: true, id }
    },
  },
  {
    name: 'list_import_adapters',
    description: '列出已注册的导入适配器。remote 为 true 的适配器自行从远端取数，调用 import_parse 时无需传 content。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    readOnly: true,
    public: false,
    handler: async () => ({ items: listImportAdapters() }),
  },
  {
    name: 'import_parse',
    description:
      '用适配器解析导入数据并生成预览，返回暂存任务 jobId。数据暂存 2 小时，随后用 import_commit 提交。远程适配器可省略 content。',
    inputSchema: {
      type: 'object',
      properties: {
        adapter: { type: 'string', description: '适配器 id，取自 list_import_adapters' },
        name: { type: 'string', description: '文件名，上传数据时必填，如 data.json' },
        content: { type: 'string', description: '文件内容的 base64 编码；远程适配器可省略' },
      },
      required: ['adapter'],
      additionalProperties: false,
    },
    readOnly: false,
    public: false,
    handler: async (args) => {
      const adapterId = String(args.adapter ?? '').trim()
      if (!adapterId) throw badRequest('缺少适配器标识')
      const adapter = getImportAdapter(adapterId)
      if (!adapter) throw badRequest(`未找到适配器：${adapterId}`)

      const content = String(args.content ?? '')
      let source: { filename: string; mime: string; buffer: Buffer } | undefined
      if (content) {
        const buffer = Buffer.from(content.replace(/^data:[^;]+;base64,/, ''), 'base64')
        if (buffer.length === 0) throw badRequest('文件内容不是合法的 base64')
        if (buffer.length > UPLOAD_MAX_BYTES) {
          throw badRequest(`导入文件超过上限 ${Math.floor(UPLOAD_MAX_BYTES / 1024 / 1024)} MB`)
        }
        source = {
          filename: String(args.name ?? `${adapterId}.json`),
          mime: 'application/octet-stream',
          buffer,
        }
      }
      if (!source && !adapter.remote) throw badRequest('该适配器需要上传文件，请传 content')

      const raws = await adapter.parse(source)
      const payload: unknown[] = []
      const invalid: { index: number; path: string; message: string }[] = []

      raws.forEach((raw, index) => {
        const parsed = noticeInputSchema.safeParse(raw)
        if (parsed.success) {
          payload.push(parsed.data)
          return
        }
        for (const issue of parsed.error.issues) {
          invalid.push({
            index,
            path: issue.path.map(String).join('.') || '(root)',
            message: issue.message,
          })
        }
      })

      await dbConnect()
      const now = new Date()
      const job = await ImportJob.create({
        adapter: adapter.id,
        filename: source?.filename ?? `${adapter.id}:remote`,
        mime: source?.mime ?? 'application/json',
        size: source?.buffer.byteLength ?? 0,
        status: 'parsed',
        total: raws.length,
        validCount: payload.length,
        invalidCount: raws.length - payload.length,
        invalid: invalid.slice(0, 200),
        payload,
        createdAt: now,
        expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
      })

      return {
        jobId: String(job._id),
        adapter: adapter.id,
        filename: source?.filename ?? `${adapter.id}:remote`,
        total: raws.length,
        validCount: payload.length,
        invalidCount: raws.length - payload.length,
        invalid: invalid.slice(0, 200),
        sample: payload.slice(0, 20),
      }
    },
  },
  {
    name: 'import_commit',
    description:
      '提交导入任务，把预览阶段的有效数据写入文章集合。channel 可统一覆盖所有条目频道；duplicate 决定遇到重复时 skip 跳过或 overwrite 覆盖。',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', description: 'import_parse 返回的任务 id' },
        channel: { type: 'string', description: '覆盖所有条目的频道名，≤ 60 字' },
        duplicate: {
          type: 'string',
          enum: ['skip', 'overwrite'],
          description: '重复处理方式，默认 skip',
        },
      },
      required: ['jobId'],
      additionalProperties: false,
    },
    readOnly: false,
    public: false,
    handler: async (args) => {
      const input = importCommitSchema.parse(args)
      await dbConnect()
      const job = await ImportJob.findById(input.jobId)
      if (!job) throw badRequest('导入任务不存在或已过期')
      if (job.status === 'committed') throw badRequest('该导入任务已提交')

      const report = await commitPayload({
        adapterId: job.adapter,
        payload: job.payload,
        channel: input.channel,
        duplicate: input.duplicate,
      })

      job.status = 'committed'
      await job.save()
      return report
    },
  },
  {
    name: 'get_settings',
    description: '读取脱敏后的站点设置。存储凭据只返回是否已配置与末四位掩码，真实值不下发。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    readOnly: true,
    public: false,
    handler: async () => toSettingDto(await getSetting()),
  },
  {
    name: 'update_settings',
    description:
      '局部更新站点设置。media.credentials 中值为字符串表示写入、null 或空串表示清除；不在白名单内的键被忽略。',
    inputSchema: {
      type: 'object',
      properties: {
        admin: {
          type: 'object',
          properties: { username: { type: 'string', description: '管理员用户名，≤ 40 字' } },
          description: '管理员相关设置',
        },
        media: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['base64', 'url', 'r2', 'vercel', 'webdav', 'edgeone'],
              description: '存储类型',
            },
            maxUploadSize: { type: 'integer', description: '单文件上传上限（字节），1024 到 4194304' },
            allowedFormats: {
              type: 'array',
              items: { type: 'string' },
              description: '扩展名白名单，服务端转小写',
            },
            credentials: {
              type: 'object',
              description: '存储凭据，键取自 STORAGE_CREDENTIAL_KEYS；值为 null 表示清除',
              additionalProperties: { type: ['string', 'null'] },
            },
          },
          description: '媒体存储设置',
        },
      },
      additionalProperties: false,
    },
    readOnly: false,
    public: false,
    handler: async (args) => {
      const patch = settingsPatchSchema.parse(args)
      const set: Record<string, unknown> = {}
      const unset: Record<string, unknown> = {}

      if (patch.admin?.username !== undefined) set['admin.username'] = patch.admin.username
      if (patch.media?.type !== undefined) set['media.type'] = patch.media.type
      if (patch.media?.maxUploadSize !== undefined) set['media.maxUploadSize'] = patch.media.maxUploadSize
      if (patch.media?.allowedFormats !== undefined) {
        set['media.allowedFormats'] = patch.media.allowedFormats.map((format) => format.toLowerCase())
      }

      for (const [key, value] of Object.entries(patch.media?.credentials ?? {})) {
        if (!(STORAGE_CREDENTIAL_KEYS as readonly string[]).includes(key)) continue
        if (value === null || value === '') {
          unset[`media.${key}`] = ''
          continue
        }
        set[`media.${key}`] = value
      }

      if (Object.keys(set).length > 0 || Object.keys(unset).length > 0) {
        await dbConnect()
        await Setting.updateOne(
          { _id: 'singleton' },
          {
            ...(Object.keys(set).length > 0 ? { $set: set } : {}),
            ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
          },
        )
        clearSettingCache()
      }

      return toSettingDto(await getSetting())
    },
  },
  {
    name: 'change_password',
    description:
      '修改管理员密码。成功后 sessionVersion 自增，所有已签发的会话立即失效，需要重新 login。',
    inputSchema: {
      type: 'object',
      properties: {
        currentPassword: { type: 'string', description: '当前密码' },
        newPassword: { type: 'string', description: '新密码，无强度限制' },
      },
      required: ['currentPassword', 'newPassword'],
      additionalProperties: false,
    },
    readOnly: false,
    public: false,
    handler: async (args) => {
      const input = passwordChangeSchema.parse(args)
      const setting = await getSetting()
      if (!verifyPassword(input.currentPassword, setting.admin.passwordHash, setting.admin.passwordSalt)) {
        throw badRequest('当前密码不正确')
      }
      if (input.currentPassword === input.newPassword) throw badRequest('新密码不能与当前密码相同')

      const { hash, salt } = hashPassword(input.newPassword)
      await dbConnect()
      await Setting.updateOne(
        { _id: 'singleton' },
        {
          $set: {
            'admin.passwordHash': hash,
            'admin.passwordSalt': salt,
            'admin.passwordUpdatedAt': Math.floor(Date.now() / 1000),
          },
          $inc: { 'admin.sessionVersion': 1 },
        },
      )
      clearSettingCache()
      return { changed: true, note: '所有会话已失效，请重新调用 login' }
    },
  },
]

export function findTool(name: string): McpTool | undefined {
  return MCP_TOOLS.find((tool) => tool.name === name)
}

export async function callTool(name: string, args: Record<string, unknown>, request: Request): Promise<McpToolResult> {
  const tool = findTool(name)
  if (!tool) return text({ error: `未知工具 ${name}` }, true)

  if (!tool.public) {
    try {
      await requireAdmin()
    } catch (error) {
      return text({ error: `未登录或会话已失效：${errorMessage(error)}。请先调用 login 工具获取 Cookie` }, true)
    }
  }

  try {
    return text(await tool.handler(args, request))
  } catch (error) {
    return text({ error: errorMessage(error) }, true)
  }
}

export function toolListPayload(): { tools: unknown[] } {
  return {
    tools: MCP_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: { readOnlyHint: tool.readOnly },
    })),
  }
}
