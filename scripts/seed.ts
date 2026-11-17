// scripts/seed.ts
import mongoose from 'mongoose'
import dbConnect from '../lib/db'
import { Setting } from '../lib/server/models/setting'
import { Notice } from '../lib/server/models/notice'
import { Media } from '../lib/server/models/media'
import { hashPassword } from '../lib/server/auth-password'
import {
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_USERNAME,
  DEFAULT_ALLOWED_FORMATS,
  UPLOAD_MAX_BYTES,
} from '../lib/shared/constants'

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/wD/6X8kAAAAAElFTkSuQmCC'

function deriveSummary(body: string): string {
  return body
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*`_~|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

const SAMPLE_NOTICES = [
  {
    channel: '产品',
    priority: 'high' as const,
    title: '通知中心 2.0 上线',
    tags: ['版本', '更新'],
    body: `## 本次更新

- 列表支持卡片、瀑布流、列表三种视图
- 新增多条件筛选与关键词搜索
- 详情页支持 Markdown 与 HTML 两种正文

## 后续计划

1. 批量导入适配器
2. 媒体库增强`,
  },
  {
    channel: '运营',
    priority: 'normal' as const,
    title: '十一月运营活动排期',
    tags: ['公告', '运营'],
    body: `本月活动集中在三个方向：

- 新用户引导
- 老用户召回
- 内容共创

具体排期以各负责人同步为准。`,
  },
  {
    channel: '安全',
    priority: 'urgent' as const,
    title: '请立即更新管理员密码',
    tags: ['安全'],
    body: `默认密码仅用于初始化，请登录后台后在「设置 → 账号」中修改。

建议使用 10 位以上、包含字母与数字的密码。`,
  },
  {
    channel: '产品',
    priority: 'normal' as const,
    title: '编辑器支持图片直传',
    tags: ['版本', '功能'],
    body: `在编辑页插入图片时会直接上传到当前配置的存储，插入的地址统一为站内媒体路由。

这样切换存储类型后，历史文章的图片也不会失效。`,
  },
  {
    channel: '运营',
    priority: 'low' as const,
    title: '内容撰写规范（试行）',
    tags: ['公告'],
    body: `## 标题

不超过 200 字，避免口语化。

## 摘要

不填时会自动取正文前 120 字。

## 正文

优先使用 Markdown；如需粘贴 HTML，渲染前会做安全净化。`,
  },
  {
    channel: '安全',
    priority: 'high' as const,
    title: '媒体访问统一走站内路由',
    tags: ['安全', '维护'],
    body: `所有媒体只通过 \`/api/media/{id}\` 暴露，原始存储地址不会下发到浏览器。

外部链接类型的媒体由服务端代理，并拒绝内网地址。`,
  },
  {
    channel: '产品',
    priority: 'normal' as const,
    title: '使用 HTML 正文的示例',
    tags: ['示例'],
    body: `<h2>HTML 正文示例</h2>
<p>这一段来自导入数据的 HTML，渲染前会经过白名单净化。</p>
<ul>
  <li>保留语义标签</li>
  <li>移除脚本与事件属性</li>
</ul>
<p><a href="https://example.com">外链会自动补 rel 与 target</a></p>`,
  },
  {
    channel: '运营',
    priority: 'low' as const,
    title: '关于频道与标签的使用',
    tags: ['公告', '运营'],
    body: `频道目前是字符串，直接填写业务线名称即可；标签用于跨频道聚合，单篇最多 8 个。`,
  },
]

async function seedSetting(): Promise<void> {
  const existing = await Setting.findById('singleton')
  if (existing) {
    console.log('站点设置已存在，跳过初始化')
    return
  }

  const password = process.env.ADMIN_INIT_PASSWORD || DEFAULT_ADMIN_PASSWORD
  const { hash, salt } = hashPassword(password)

  await Setting.create({
    _id: 'singleton',
    admin: {
      username: DEFAULT_ADMIN_USERNAME,
      passwordHash: hash,
      passwordSalt: salt,
      passwordUpdatedAt: Math.floor(Date.now() / 1000),
      sessionVersion: 0,
    },
    media: {
      type: 'base64',
      maxUploadSize: UPLOAD_MAX_BYTES,
      allowedFormats: [...DEFAULT_ALLOWED_FORMATS],
    },
  })

  console.log(`站点设置已初始化，用户名 ${DEFAULT_ADMIN_USERNAME}`)
}

async function seedMedia(): Promise<string[]> {
  const count = await Media.countDocuments()
  if (count > 0) {
    const ids = await Media.find({}, { _id: 1 }).limit(2).lean<{ _id: mongoose.Types.ObjectId }[]>()
    return ids.map((doc) => String(doc._id))
  }

  const docs = await Media.create([
    { type: 'base64', src: PNG_BASE64, format: 'png', name: '示例封面', author: { name: '系统' } },
    { type: 'base64', src: PNG_BASE64, format: 'png', name: '示例附件', author: { name: '系统' } },
  ])

  return docs.map((doc) => String(doc._id))
}

async function seedNotices(mediaIds: string[]): Promise<void> {
  const count = await Notice.countDocuments()
  if (count > 0) {
    console.log(`已有 ${count} 篇文章，跳过样例数据`)
    return
  }

  const now = Math.floor(Date.now() / 1000)
  const docs = SAMPLE_NOTICES.map((item, index) => ({
    meta: {
      type: 'article' as const,
      channel: item.channel,
      priority: item.priority,
      timestamp: now - index * 86400,
    },
    content: {
      title: item.title,
      summary: deriveSummary(item.body),
      body: item.body,
      author: { name: index % 2 === 0 ? '产品组' : '运营组' },
      cover: mediaIds.length ? mediaIds[index % mediaIds.length] : '',
      tags: item.tags,
      entities: mediaIds.length && index === 1 ? [mediaIds[1]] : [],
    },
    interaction: { views: [], likes: [], comments: [] },
  }))

  await Notice.insertMany(docs)
  console.log(`已写入 ${docs.length} 篇样例文章`)
}

async function main(): Promise<void> {
  await dbConnect()
  await seedSetting()
  const mediaIds = await seedMedia()
  await seedNotices(mediaIds)
  await mongoose.connection.close()
  console.log('seed 完成')
}

main().catch(async (error) => {
  console.error('seed 失败：', error)
  await mongoose.connection.close().catch(() => undefined)
  process.exitCode = 1
})
