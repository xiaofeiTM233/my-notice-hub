# my-notice-hub 实现计划

> 状态：**定稿（待开工）**｜版本：v2｜已并入你对 11 个问题的全部裁决

> 后续变更：初始化已改为首次登录请求时写入 `Setting`，`scripts/seed.ts` 与 `npm run seed` 已移除；下文保留原始规划以作追溯，实现以 `lib/server/bootstrap.ts` 与 `docs/DEVELOPMENT.md` 为准。

---

## 0. 结论摘要

- **形态**：单仓库、单 Next 应用，**严格前后端分离**。后端只有 `app/api/**/route.ts`；页面全是客户端组件，通过统一 fetch 客户端调自己的 API；页面层不 import 任何 Mongoose 模型。
- **视觉**：Ant Design 6（`zh_CN`）+ Tailwind 4 仅做布局工具类，自建设计令牌，明暗双主题。品牌与标题写死，无页脚，图标沿用 `public/vercel.svg`。
- **媒体**：六种存储（base64 / url / r2 / vercel / webdav / edgeone）全部收敛在**单个** `lib/media.ts`；对外只有 `/api/media/{id}`，任何响应体都不出现原始 `src`。
- **导入**：适配器接口 + 注册表 + 三步向导全部就绪，已接入 `zmd`（聚合接口）与 `zmd-web`（官网公告）适配器，均支持实时拉取。
- **数据**：你给的 2 个模型（通知 / 媒体）+ `Setting`（`_id: "singleton"`）+ `ImportJob`（导入暂存）。**不建日志集合、不做互动写入、不做 SEO**。
- **部署**：Vercel。上传上限 4 MB（平台请求体限制），base64 单文件 512 KiB，初始化在首次登录请求时完成。

```text
访客站 (client)                      管理后台 (client)
   │  fetch /api/notices                │  fetch /api/admin/**（session cookie）
   ▼                                    ▼
┌─────────────────────────────────────────────────────────────┐
│ app/api/**/route.ts  ── Zod 校验 ── 统一 envelope            │
│          │                                                   │
│          ├── lib/server/queries/*   查询组装 / DTO 映射       │
│          ├── lib/server/models/*    Mongoose 模型             │
│          ├── lib/server/guard.ts    requireAdmin()            │
│          ├── lib/media.ts           六种存储适配器（单文件）   │
│          └── proxy.ts               会话门（/admin、/api/admin）│
└─────────────────────────────────────────────────────────────┘
                              │
                        MongoDB / 对象存储
```

---

## 1. 已定稿决策

| # | 决策点 | 结论 | 对实现的约束 |
| :- | :--- | :--- | :--- |
| D1 | 前后端分离 | **纯 API 驱动** | 页面不直连数据库；`lib/server/**` 只被 route handler 与 `proxy.ts` 引用 |
| D2 | 认证 | **单管理员 + JWT** | 不建用户集合；scrypt 哈希存 `Setting`；`proxy.ts` 做门 + 每个管理 API 二次校验 |
| D3 | 正文 | **Markdown + HTML** | 含标签走 `sanitize-html` 净化，否则 `MdPreview` 渲染 |
| D4 | 互动 | **不处理** | 不写浏览量/点赞/评论，不渲染相关 UI；`interaction` 字段保留默认空数组，仅随数据原样存取 |
| D5 | `meta.type` | **仅 `article`** | 删除 `system/interaction/…` 六值；筛选维度为「频道 + 优先级 + 标签 + 时间 + 关键词」 |
| D6 | `channel` | **字符串** | 不建频道集合；导航与筛选对 `meta.channel` 做 `distinct` 聚合 |
| D7 | 辅助字段 | **不加** | Notice 无 `createdAt/updatedAt`；Media 无 `size/mime/时间`；排序用 `meta.timestamp` / `_id` 倒序 |
| D8 | 媒体类型 | **补 `webdav`** | 六值：`base64/url/r2/vercel/webdav/edgeone` |
| D9 | HTML 净化 | **允许 `sanitize-html`** | 渲染 HTML 正文前服务端净化，白名单见 §6.5 |
| D10 | 日志与互动 | **全部移除** | 无 `Log` 集合、无审计 API、无 `/admin/logs`；出错只写服务端 `console.error` |
| D11 | 初始化 | **首次登录建 Setting（含默认密码）** | 无 bootstrap 接口、无初始化页；默认密码登录后自行修改 |
| D12 | SEO / 公开 | **不需要** | 公开页也按客户端渲染；`metadata` 静态写死；不生成 sitemap/robots |
| D13 | 品牌 | **写死、无页脚** | 站名一个常量；沿用 `public/vercel.svg` 作 Logo/图标 |
| D14 | 部署 | **Vercel** | 上传 ≤ 4 MB；base64 ≤ 512 KiB；限流为实例内存（弱）；seed 本地执行 |

---

## 2. 技术基线与依赖

### 2.1 版本矩阵（2026-11 实测 npm 最新）

| 包 | 版本 | 用途 / 备注 |
| :--- | :--- | :--- |
| next | 16.4.6（已装） | Turbopack 默认、`cacheComponents`、`proxy.ts`、Node ≥ 20.9 |
| react / react-dom | 19.3.0（已装） | — |
| antd | ^6.7.1 | 默认 CSS 变量；`@ant-design/icons` 必须 ≥ 6 |
| @ant-design/icons | ^6.3.4 | v6 与 antd 5 不兼容，锁 6 |
| @ant-design/nextjs-registry | ^1.3.0 | App Router 首屏样式抽取，防闪动 |
| @ant-design/cssinjs | ~2.1.2 | 显式锁到 antd 依赖范围，避免双实例 |
| next-auth | 5.0.0-beta.32 | 声明支持 `next ^16`；`proxy.ts` 导出 `auth as proxy` |
| md-editor-rt | ^7.1.0 | 编辑器 + 只读预览 + 目录 |
| zustand | ^5.1.0 | UI 偏好（主题、侧栏、视图） |
| zod | ^4.6.7 | 请求/响应/表单单一事实源 |
| mongoose | ^9.12.2 | 需 Node ≥ 20.19（本机 24.22 ✅） |
| @aws-sdk/client-s3 | ^3.1170.0 | R2 |
| @vercel/blob | ^2.9.0 | Vercel Blob（部署目标同平台，默认推荐） |
| @edgeone/pages-blob | ^0.0.19 | EdgeOne Blob |
| webdav | ^5.11.0 | WebDAV |
| sanitize-html | ^2.18.2 | HTML 正文净化 |
| clsx | ^2.1.1 | 类名拼接 |
| dayjs | ^1.11.11 | 日期格式化（antd 同源） |
| server-only | ^0.0.1 | 防止服务端模块进客户端包 |
| tsx（dev） | ^4 | 冒烟与导入脚本 |

**不引入**：SWR / TanStack Query（自写 ~80 行 `useApiQuery`）、axios、lodash、next-themes（主题自写才能与 antd 算法同步）、sharp（不做缩略图）。

### 2.2 Next 16 在本项目里的硬约束

1. `cacheComponents: true` 已开 → **禁止** `export const dynamic / revalidate / fetchCache`。页面是客户端外壳，天然静态；API 处理器碰数据库或 `request.nextUrl` 即自动转动态。
2. `middleware.ts` 已改名 `proxy.ts`，导出函数名 `proxy`，运行时固定 Node.js。Auth.js 写法：`export { auth as proxy } from "@/auth"`，路径判断与 401 分流在同文件完成。
3. 客户端组件里 `useSearchParams()` 必须包 `<Suspense>`，否则构建期报错。列表页筛选走 URL，这个边界要处理好。
4. `next/dynamic` + `ssr: false` 只能出现在客户端组件里（`MdEditor` / `MdPreview` / `MdCatalog`）。
5. 路由类型已生成：页面用 `PageProps<'/notices/[id]'>` / `LayoutProps<'/'>`，处理器用全局 `RouteContext<'/api/media/[id]'>`，不手写 `{ params }` 类型。
6. `partialPrefetching` 是实验特性，只保持开启，不依赖其行为。
7. `app/layout.tsx` 的 `next/font/google` 会在构建期联网拉字体，中文收益低 → 移除，改系统字体栈。
8. **Vercel**：Request Body 上限约 4.5 MB → 上传接口限制 4 MB；函数实例无状态 → 导入暂存必须落库（已设计 `ImportJob`）；内存限流在多实例下为弱限流。

### 2.3 Tailwind 4 与 antd 6 共存

```css
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/preflight.css" layer(base);
@import "tailwindcss/utilities.css" layer(utilities);
```

- antd 的 CSS-in-JS 注入无 layer，优先级高于 Tailwind 的 `base`，不会被 preflight 打乱。
- Tailwind 只用于自定义外壳的布局/间距/排版；**所有交互控件一律 antd**。
- 主题切换不用 Tailwind `dark:`，统一 `[data-theme="dark"]` + CSS 变量，让 antd 算法与自定义样式描述同一事实。

---

## 3. 目录结构

```text
app/
  layout.tsx                     根布局：静态 metadata、主题防闪脚本、全局 Provider
  globals.css                    Tailwind 分层 + 设计令牌 + 正文排版
  error.tsx / not-found.tsx      全局错误与 404
  (site)/
    layout.tsx                   站点顶栏（无页脚）
    page.tsx                     列表页（卡片/瀑布流/列表）
    notices/[id]/page.tsx        详情页
  admin/
    login/page.tsx               登录（无侧栏）
    (dashboard)/
      layout.tsx                 侧栏 + 顶栏（侧栏为主）
      page.tsx                   → 重定向 /admin/notices
      notices/page.tsx           文章列表
      notices/new/page.tsx       新建
      notices/[id]/edit/page.tsx 编辑
      import/page.tsx            批量导入
      media/page.tsx             媒体库
      settings/page.tsx          设置（账号 / 媒体存储 两个页签）
  api/
    auth/[...nextauth]/route.ts  Auth.js 处理器
    notices/route.ts             公开列表
    notices/[id]/route.ts        公开详情
    channels/route.ts            频道与计数（distinct 聚合）
    tags/route.ts                标签与计数
    media/[id]/route.ts          ★ 媒体字节出口（唯一对外地址）
    admin/
      notices/route.ts           管理列表 / 新建
      notices/[id]/route.ts      详情 / 更新 / 删除
      notices/batch/route.ts     批量删除
      media/route.ts             列表 / 上传
      media/[id]/route.ts        重命名 / 删除
      import/adapters/route.ts   已注册适配器
      import/parse/route.ts      解析 + 校验 + 暂存
      import/commit/route.ts     确认写入
      settings/route.ts          读 / 改设置（密钥脱敏）
      settings/password/route.ts 改密码
      settings/storage/test/route.ts 存储连通性测试

auth.ts                          next-auth 配置（Credentials + JWT + 会话版本）
proxy.ts                         会话门（Node 运行时）

components/
  providers/AppProviders.tsx     AntdRegistry + ConfigProvider + App + SessionProvider
  site/                          SiteHeader、FilterPanel、NoticeCard、MasonryGrid、
                                 NoticeListRow、ViewSwitch、SearchBox、PaginationBar
  admin/                         AdminShell、AdminSider、AdminHeader、NoticeTable、
                                 NoticeFilterBar、NoticeForm、MetaPanel、MediaPicker、
                                 MediaGrid、MediaDetailDrawer、ImportWizard、
                                 SettingsTabs、PasswordForm、StorageForm
  editor/MarkdownEditor.tsx      md-editor-rt 编辑器（动态加载 + 图片上传联动）
  editor/ContentRenderer.tsx     Markdown / HTML 双通道渲染
  common/                        ThemeToggle、MediaImage、PageHeader、SectionCard、
                                 EmptyState、ErrorState、ConfirmDelete、StatBadge

hooks/
  useApiQuery.ts                 带 AbortController 的取数
  useApiMutation.ts              写操作 + message 反馈
  useUrlFilters.ts               antd Form ↔ URLSearchParams 双向同步
  useThemeMode.ts                light/dark/system + html[data-theme]

lib/
  db.ts                          （沿用你的实现）
  media.ts                       ★ 六种存储适配器 + 读写调度（单文件）
  shared/
    contracts/                   Zod：common / notice / media / settings / import
    constants.ts                 站点名、优先级、存储类型、分页上限、上传上限
    format.ts                    时间、字节、摘要截断
    theme.ts                     设计令牌（CSS 变量与 antd token 共用）
  server/
    models/                      notice / media / setting / import-job
    dto.ts                       _id → id 映射、摘要派生、字段裁剪
    errors.ts                    ApiError 与错误码
    respond.ts                   ok() / fail() 统一出口
    guard.ts                     requireAdmin()
    rate-limit.ts                登录与上传的内存限流
    auth-password.ts             scrypt 哈希与校验（timingSafeEqual）
    queries/notice.ts            多条件查询与聚合
    import/registry.ts           适配器注册表（zmd）+ 接口
  client/
    api.ts                       fetch 封装、ApiError
    stores/ui.ts                 Zustand：主题、侧栏折叠、列表视图

docs/                            IMPLEMENTATION-PLAN / DATA-MODELS / API-CONVENTIONS /
                                 FRONTEND-SPEC / DEVELOPMENT
scripts/                         smoke-api.ts / 导入与维护脚本
public/                          vercel.svg（Logo/图标）、file.svg（空态配图）
```

**媒体相关只有一个 `lib/media.ts`**：适配器实现、配置读取、保存/读取/删除、URL 生成全在此，route handler 只做 HTTP 层（multipart 解析、Content-Type、缓存头）。

---

## 4. 数据模型

> 统一约定：Mongo 存 `_id: ObjectId`，对外 JSON 一律 `id: string`；时间统一 **Unix 秒（整数）**；子文档 `{ _id: false }`；**不开启 Mongoose `timestamps`**（D7）。

### 4.1 Notice（文章/通知，按你给的单条模型）

| 字段 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `_id` | ObjectId | ✔ | 对外 `id` |
| `meta.type` | string | ✔ | 固定 `'article'`（D5，六值已删） |
| `meta.channel` | string | ✔ | 频道名/标识字符串（D6），非集合引用 |
| `meta.priority` | enum `low/normal/high/urgent` | ✔ | 默认 `normal` |
| `meta.timestamp` | number | ✔ | 发布时间（秒），列表排序主键 |
| `content.title` | string | ✔ | 1–200 字 |
| `content.summary` | string | ✘ | 空则取正文前 120 字（去标签） |
| `content.body` | string | ✘ | Markdown 或 HTML，原样存储 |
| `content.author` | `{name?, avatar?}` | ✘ | `avatar` 为媒体 id |
| `content.cover` | string | ✘ | 媒体 id |
| `content.tags` | string[] | ✘ | 去重、去空白，≤ 8 个 |
| `content.entities` | string[] | ✘ | 媒体 id 列表（附件） |
| `interaction` | `{views[],likes[],comments[]}` | ✔ | 默认 `[]`，不读写不校验（D4） |
| `extra` | Mixed | ✘ | 业务自定义，管理端 JSON 折叠编辑 |

**不落库**：`meta.status`、`meta.expirein`（D7）。**不加** `createdAt/updatedAt`。

**索引**：`{ 'meta.timestamp': -1 }`、`{ 'meta.channel': 1, 'meta.timestamp': -1 }`、`{ 'meta.priority': 1, 'meta.timestamp': -1 }`、`{ 'content.tags': 1, 'meta.timestamp': -1 }`。

**搜索**：中文 `$text` 分词不可用，采用 `title|summary` 正则（`escapeRegExp` + `i`）；数据量超过 10 万再换 Atlas Search（§11）。

### 4.2 Media（按你给的媒体模型，补 webdav）

| 字段 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `_id` | ObjectId | ✔ | 对外 `id`，也是 `/api/media/{id}` 的路径段 |
| `type` | enum `base64/url/r2/vercel/webdav/edgeone` | ✔ | D8 |
| `src` | string | ✔ | 适配器内部标识；**永不下发** |
| `format` | string | ✔ | 小写扩展名白名单 |
| `name` | string | ✘ | 展示名，默认原文件名 |
| `author` | `{name?, avatar?}` | ✘ | 上传者（管理端固定可填） |

**不加** `size/mime/createdAt/updatedAt`（D7）。媒体库排序用 `_id` 倒序（ObjectId 自带时间精度到秒）；文件大小只在**上传响应**里返回一次，不落库。

**索引**：`{ type: 1, _id: -1 }`。

**引用完整性**：删除前用 `content.cover | content.entities | content.author.avatar` 反查；有引用返回 409 与引用文章列表，`?force=1` 强制删除（文章侧字段留空）。

### 4.3 Setting（站点设置，单例）

`_id` 固定字符串 `"singleton"`；无 `timestamps`。

| 分组 | 字段 | 说明 |
| :--- | :--- | :--- |
| 账号 | `admin.username`（默认 `admin`） | — |
| | `admin.passwordHash` / `admin.passwordSalt` | scrypt(N=16384, r=8, p=1)，16 字节盐 |
| | `admin.passwordUpdatedAt` | 秒 |
| | `admin.sessionVersion` | 整数，改密 +1，用于立刻踢掉旧 JWT |
| 媒体 | `media.type` | 六值，默认 `base64` |
| | `media.maxUploadSize` | 字节，默认 4 MiB（Vercel 请求体上限） |
| | `media.allowedFormats` | 默认 `png,jpg,jpeg,webp,gif,svg,pdf,zip,docx,xlsx,mp4` |
| | `media.vercelToken` / `r2AccessKeyId` / `r2SecretAccessKey` / `r2Endpoint` / `r2Bucket` / `r2PublicUrl` / `webdavUrl` / `webdavUser` / `webdavPass` / `webdavBasePath` / `edgeoneToken` / `edgeoneProjectId` / `edgeoneStoreName` | 按类型取用；**GET 只回 `hasXxx` + 末四位掩码** |

**初始化（D11）**：首次登录请求发现单例设置缺失时 upsert 该文档，密码取 `ADMIN_INIT_PASSWORD` 环境变量，缺省用约定的初始密码；`admin.passwordUpdatedAt` 与 `sessionVersion=0` 一并写入。没有 `/api/admin/bootstrap`，也没有初始化页。

### 4.4 ImportJob（导入暂存，过程模型）

| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `_id` | ObjectId | 预览 token 即此 id |
| `adapter` | string | 适配器 id |
| `filename` / `mime` / `size` | string/string/number | 上传文件信息 |
| `status` | enum `parsed/committed` | — |
| `total` / `validCount` / `invalidCount` | number | 统计 |
| `invalid` | `[{ index, path, message }]` | 前 200 条错误 |
| `payload` | Mixed[] | 已归一化并通过 Zod 的数据（≤ 4 MB） |
| `createdAt` / `expiresAt` | Date | TTL 索引 `expireAfterSeconds: 0`，2 小时过期 |

落库而非内存：Vercel 无实例亲和，预览与确认可能落到不同实例。

### 4.5 `_id → id` 映射与 DTO 规则

- `toId(doc)` 统一 `String(doc._id)`；入口先 `isValidObjectId`，非法直接 400 而非 500。
- 列表 DTO **不含** `body`、`extra`、`interaction`；详情 DTO 含 `body` 与 `entities`，不含 `interaction`。
- 媒体 DTO **不含** `src`：只给 `{id, type, format, name, author, url: "/api/media/{id}"}`。
- 公开与管理共用 `queries/notice.ts`，以 `scope: 'public' | 'admin'` 区分字段与过滤。

---

## 5. API 契约

### 5.1 统一响应 envelope

```ts
// 成功
{ "ok": true, "data": T, "meta": { "requestId": "r_xxx", "tookMs": 12 } }
// 失败（HTTP 状态码同时正确）
{ "ok": false, "error": { "code": "VALIDATION_FAILED", "message": "请求体校验失败", "details": [...] }, "meta": { "requestId": "r_xxx" } }
```

| code | HTTP | 场景 |
| :--- | :--- | :--- |
| `BAD_REQUEST` | 400 | 参数缺失、id 非法 |
| `VALIDATION_FAILED` | 422 | Zod 失败，`details` 为字段路径 + 消息 |
| `UNAUTHORIZED` | 401 | 未登录 / 会话失效 |
| `NOT_FOUND` | 404 | 文章/媒体不存在 |
| `CONFLICT` | 409 | 媒体被引用 |
| `RATE_LIMITED` | 429 | 登录/上传/导入超限 |
| `STORAGE_ERROR` | 502 | 适配器失败，`details` 带类型与阶段 |
| `UPSTREAM_ERROR` | 502 | url 类型代理失败 |
| `INTERNAL` | 500 | 兜底，`console.error` 留栈，响应不带 |

### 5.2 列表查询规范（公开与管理共用）

| 参数 | 类型 | 说明 |
| :--- | :--- | :--- |
| `q` | string ≤ 80 | 标题/摘要模糊匹配 |
| `channel` | string（可重复） | 频道字符串 |
| `priority` | enum（可重复） | 优先级 |
| `tag` | string（可重复） | 标签，`$all` |
| `from` / `to` | 整数秒 | `meta.timestamp` 闭区间 |
| `sort` | `newest`（默认）/`oldest` | 仅时间排序，避免无索引排序 |
| `page` | ≥1，默认 1 | — |
| `pageSize` | 1–60，默认 12 | 超限截断并回显 |

响应 `data: { items: [], total, page, pageSize }`。

### 5.3 端点清单

| 方法 | 路径 | 权限 | 用途 |
| :--- | :--- | :--- | :--- |
| GET | `/api/notices` | 公开 | 列表（§5.2） |
| GET | `/api/notices/{id}` | 公开 | 详情 |
| GET | `/api/channels` | 公开 | `distinct` + 计数（限 100） |
| GET | `/api/tags` | 公开 | `unwind` 聚合 + 计数（限 100） |
| GET `/HEAD` | `/api/media/{id}` | 公开 | 媒体字节，`?download=1`、`If-None-Match` |
| GET | `/api/admin/notices` | 管理 | 同列表 + `author`、`hasCover` 过滤 |
| POST | `/api/admin/notices` | 管理 | 新建 |
| GET | `/api/admin/notices/{id}` | 管理 | 编辑用完整数据 |
| PATCH | `/api/admin/notices/{id}` | 管理 | 局部更新（字段缺省不动，`null` 清空） |
| DELETE | `/api/admin/notices/{id}` | 管理 | 删除 |
| POST | `/api/admin/notices/batch` | 管理 | 批量删除（≤100） |
| GET | `/api/admin/media` | 管理 | `q`/`type`/`format` + 分页 |
| POST | `/api/admin/media` | 管理 | multipart 单文件上传 |
| PATCH | `/api/admin/media/{id}` | 管理 | 重命名 / 作者 |
| DELETE | `/api/admin/media/{id}` | 管理 | 删除，`?force=1` 忽略引用 |
| GET | `/api/admin/import/adapters` | 管理 | 已注册适配器（zmd） |
| POST | `/api/admin/import/parse` | 管理 | 上传或远程拉取 + 解析 + 校验 → ImportJob 预览 |
| POST | `/api/admin/import/commit` | 管理 | 按 jobId 写入 + 结果报告 |
| GET/PATCH | `/api/admin/settings` | 管理 | 读（脱敏）/ 改 |
| POST | `/api/admin/settings/password` | 管理 | 改密码 |
| POST | `/api/admin/settings/storage/test` | 管理 | 试写/读/删 1×1 png |
| GET/POST | `/api/auth/[...nextauth]` | — | Auth.js |

### 5.4 Zod 合约（`lib/shared/contracts/`）

| 文件 | 关键导出 |
| :--- | :--- |
| `common.ts` | `envelopeSchema`、`paginationQuerySchema`、`objectIdSchema`、`unixSecondsSchema` |
| `notice.ts` | `noticeQuerySchema`、`noticeCreateSchema`、`noticeUpdateSchema`、`noticeSummaryDtoSchema`、`noticeDetailDtoSchema` |
| `media.ts` | `mediaQuerySchema`、`mediaTypeSchema`、`mediaDtoSchema` |
| `settings.ts` | `settingsDtoSchema`、`settingsPatchSchema`、`storageConfigSchema`、`passwordChangeSchema` |
| `import.ts` | `importParseResultSchema`、`importCommitSchema`、`importReportSchema` |

约定：**每个请求体与响应体都有 schema**；处理器进入时 `parse` 输入、开发期 `parse` 输出；前端从同一 schema 推导类型，不手写重复 interface。

### 5.5 鉴权

```ts
// auth.ts
providers: [Credentials({ authorize: 校验 username + scrypt 密码 → { id: 'admin', name } })]
session: { strategy: 'jwt', maxAge: 12 * 60 * 60 }
pages: { signIn: '/admin/login' }
callbacks.jwt / session：写入 username 与 sessionVersion
```

- `proxy.ts`：`export { auth as proxy }` + `matcher: ['/admin/:path*', '/api/admin/:path*']`；页面未登录跳 `/admin/login?next=…`，`/api/admin/**` 未登录回 envelope 401。
- `requireAdmin()`：`auth()` → 比对 `sessionVersion` 与 Setting；**每个管理处理器第一行调用**，不依赖 proxy 单点。
- 登录限流：同 IP 10 分钟 5 次，超限 429；成功清零（实例内存，Vercel 多实例下为弱限流）。
- 密码：scrypt + 16 字节随机盐，`timingSafeEqual`；强度 ≥ 10 位且含字母与数字；改密后 `sessionVersion + 1`。

### 5.6 错误与可观测性

无日志集合（D10）。仅：响应头 `x-request-id`（`crypto.randomUUID()`）+ 服务端 `console.error`（Vercel Logs 可查）。前端错误态展示 `requestId`，便于你把日志贴给我定位。

---

## 6. 媒体子系统

### 6.1 单文件 `lib/media.ts`

```ts
export type MediaType = 'base64' | 'url' | 'r2' | 'vercel' | 'webdav' | 'edgeone'

interface Adapter {
  save(name: string, buffer: Buffer, format: string): Promise<{ src: string; size: number }>
  load(src: string): Promise<Buffer>
  remove(src: string): Promise<void>
}

export async function loadMediaConfig(): Promise<MediaConfig>   // 读 Setting.media
export async function createAdapter(config): Promise<Adapter>   // 按 type 动态 import
export async function saveMedia(input): Promise<MediaDoc>       // 校验 + 写 + 建 Media
export async function readMedia(media: MediaDoc): Promise<{ buffer: Buffer; mime: string }>
export async function removeMedia(media: MediaDoc): Promise<void>
export function mediaUrl(id: string): string                    // `/api/media/${id}`
```

| type | save | load | 说明 |
| :--- | :--- | :--- | :--- |
| `base64` | `buffer.toString('base64')` | 解码（兼容 `data:…;base64,` 前缀） | 默认；单文件 ≤ 512 KiB |
| `url` | 不支持（400） | 服务端 fetch 代理 | 仅导入/外链登记；`src` 只写不发 |
| `r2` | `PutObject`，key `yyyy/mm/{uuid}.{fmt}` | `GetObject` | 凭证显式传 `S3Client`，不读 env |
| `vercel` | `put(key, buffer, { access:'public', token, contentType })` | fetch URL | 移除示例里对 `process.env.VERCEL_BLOB_READ_WRITE_TOKEN` 的全局写入 |
| `webdav` | `putFileContents(basePath + key, buffer)` | `getFileContents` | basePath 首尾 `/` 归一 |
| `edgeone` | `store.set(key, arrayBuffer)` | `store.get(key, { type:'arrayBuffer' })` | 复用你示例里 SharedArrayBuffer 的拷贝处理 |

要点：
- 全部逻辑在一个文件，不拆 `lib/storage/*`；原示例删除（Git 历史保留），`Adapter` 类型定义也放本文件。
- SDK 用**动态 `import()`**，只加载启用的那一种，避免四个 SDK 全进冷启动。
- `src` 不外泄，后台「复制链接」复制 `/api/media/{id}`。
- 文件名清洗 `[a-zA-Z0-9._-]{1,80}`；`format` 走白名单，不信任客户端 MIME。

### 6.2 媒体路由 `/api/media/[id]`

```text
GET /api/media/65f...?download=1
 → 校验 ObjectId → 查 Media → 无则 404
 → If-None-Match 命中 → 304
 → 适配器 load → Buffer
 → 200 + Content-Type + Content-Length + ETag + Cache-Control
```

- `ETag: "m-<id>"`（媒体条目不可变）；`Cache-Control: public, max-age=31536000, immutable`；`url` 类型降为 `public, max-age=3600`。
- `Content-Disposition: inline`，`?download=1` 时 `attachment; filename*=UTF-8''…`。
- `X-Content-Type-Options: nosniff` + `Content-Security-Policy: default-src 'none'`（防 SVG 内嵌脚本）。
- 不做尺寸变换（无 sharp），缩略图由前端 `width/height` + 懒加载处理。

### 6.3 `url` 类型的代理与 SSRF

仅允许 `http`/`https`；超时 8s；`Content-Length` ≤ 20 MiB，读取时流式截断；解析主机后拒绝 `localhost`、`*.local`、10/8、172.16/12、192.168/16、169.254/16、127/8、IPv6 回环/链路本地；`redirect: 'manual'`，最多 2 跳且每跳重新校验；失败返回 `UPSTREAM_ERROR`。

### 6.4 上传与选图

- `POST /api/admin/media`：`multipart/form-data`，单文件 ≤ `min(4 MB, Setting.media.maxUploadSize)`，格式白名单。
- 流程：读 buffer → 计算 `format`（扩展名优先，其次 magic bytes）→ `saveMedia` → 返回 `MediaDto`（此次附带 `size`，不落库）。
- 编辑器 `onUploadImg`：上传后插入 `![alt](/api/media/{id})`。
- `MediaPicker`：媒体库同款网格 + 上传 + 单选/多选，供封面、作者头像、附件复用。

### 6.5 HTML 正文净化（D3/D9）

`sanitize-html` 白名单：`h1–h4, p, br, hr, strong, em, u, s, blockquote, ul, ol, li, table, thead, tbody, tr, th, td, code, pre, a, img, figure, figcaption, span, div`；属性：`a[href,title,target,rel]`、`img[src,alt,width,height,loading]`、`*[class]`（仅 `md-*`）；协议仅 `http/https/mailto` 与站内相对路径；外链自动补 `rel="noopener noreferrer"`、`target="_blank"`。

---

## 7. 前端设计

### 7.1 设计语言

**定位**：对外像「公告刊物的电子版」，对内像「安静高效的工作台」。靠留白、字重层级与克制的品牌色，不做花活。

| 令牌 | 亮色 | 暗色 |
| :--- | :--- | :--- |
| 品牌 `--brand` | `#2F5BEA` | `#5B82FF` |
| 页面底色 `--bg` | `#F4F6FB` | `#0B0F17` |
| 卡片/容器 `--surface` | `#FFFFFF` | `#131A26` |
| 次级容器 `--surface-2` | `#F8FAFF` | `#182131` |
| 边框 `--border` | `#E6EAF2` | `#232C3B` |
| 主文字 `--text` | `#0F172A` | `#E8ECF3` |
| 次文字 `--text-2` | `#5B6577` | `#93A0B4` |

- 语义色：成功 `#16A34A`、警告 `#D97706`、错误 `#DC2626`；优先级：`urgent #E5484D`、`high #F59E0B`、`normal #2F5BEA`、`low #8A94A6`（`Tag variant="filled"` + 色点，不用高饱和实底）。
- 圆角 `6/10/14/999`；间距 4 的倍数（主用 8/12/16/24/32）；页面留白 24（移动 16）。
- 阴影：亮色 `0 1px 2px rgba(15,23,42,.05), 0 10px 24px -12px rgba(15,23,42,.18)`；暗色改 1px 亮边框。
- 字体：`Inter, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif`；正文 15/1.75，标题 32/600（卡片 18/600）。
- 动效 150ms `ease-out`，尊重 `prefers-reduced-motion`。
- antd token：`colorPrimary=--brand`、`borderRadius=10`、`colorBgLayout=--bg`、`colorBgContainer=--surface`、`colorText=--text`、`fontSize=14`；暗色 `darkAlgorithm`，亮色 `defaultAlgorithm`（`cssVar` 默认开启）。
- 品牌：`SITE_NAME = '通知中心'` 写死在 `lib/shared/constants.ts`；Logo/图标用 `public/vercel.svg`；**无页脚**（D13）。

### 7.2 访客站

```text
┌───────────────────────────────────────────────────────────────────────┐
│ ◆ 通知中心      全部  产品  运营  安全        [ 搜索公告… ]    ☀ ◐ ☾   │ 64 sticky
├───────────────────────────────────────────────────────────────────────┤
│ 最新公告  共 128 条                              [卡片 | 瀑布 | 列表] │
│ ┌─────────┐  ┌───────────┐ ┌───────────┐ ┌───────────┐                │
│ │ 筛选    │  │ 封面 16:9 │ │ 封面 16:9 │ │ 封面 16:9 │                │
│ │ 频道    │  ├───────────┤ ├───────────┤ ├───────────┤                │
│ │ 优先级  │  │ 标题      │ │ 标题      │ │ 标题      │                │
│ │ 标签    │  │ 摘要…     │ │ 摘要…     │ │ 摘要…     │                │
│ │ 时间    │  │ 频道 时间 │ │ 频道 时间 │ │ 频道 时间 │                │
│ │ 排序    │  └───────────┘ └───────────┘ └───────────┘                │
│ └─────────┘                     [ ‹ 1 2 3 … 11 › ]                    │
└───────────────────────────────────────────────────────────────────────┘
```

- **顶栏**：品牌（`vercel.svg` + 站名）；频道导航取 `/api/channels`，最多 6 项，溢出进「更多」；搜索框 240px，移动端折叠为图标；右侧主题 `Segmented`（☀/◐/☾，`system` 跟随 `matchMedia`）。
- **筛选侧栏**（≥1200 显示，240px，`sticky top: 88px`）：频道（`Radio` 竖排带计数）、优先级（多选 `Tag`）、标签（前 12 + 「更多」）、时间（`RangePicker` → 秒）、排序；底部「重置」。移动端收进 `Drawer`（用 `size`，不用已废弃的 `width`）。
- **视图切换**：`Segmented` 三态，存 Zustand 并持久化，同时写 URL `?view=`；卡片 grid 3/2/1；瀑布流 CSS `columns` + `break-inside: avoid`（无 JS 定位、无抖动）；列表左缩略图 128×84。
- **分页**：`Pagination` 居中，`pageSize` 默认 12（可改），URL 带 `page`；筛选变化重置第 1 页。
- **详情页**：面包屑 → 标题（32/600）→ 元信息（频道 · 时间 · 作者 · 优先级）→ 封面 → 正文（最大 720px）→ 附件卡片组 → 标签 → 上一篇/下一篇。≥1280 右侧 200px 粘性目录（`MdCatalog`，仅 Markdown 正文有）；`FloatButton.BackTop`。正文图片一律 `/api/media/{id}` + `loading="lazy"`。
- **状态**：骨架屏、空态（「没有匹配的公告」+ 重置）、错误态（`requestId` + 重试）。
- **HTML 正文**：服务端净化后输出；渲染前已保证干净。

### 7.3 管理后台（侧栏为主）

```text
┌────────────┬──────────────────────────────────────────────────────────┐
│ ◆ 通知中心 │ ☰  内容 / 文章列表                    ⌘K   ☾   ▾ 管理员    │ 56
├────────────┼──────────────────────────────────────────────────────────┤
│ 内容       │ 文章列表                          [批量导入] [+ 新建]     │
│  文章列表  │ ┌ 关键词 ── 频道 ─┬ 优先级 ─┬ 标签 ─┬ 时间 ──  [查询][重置]│
│  新建文章  │ └───────────────────────────────────────────────────────┘│
│  批量导入  │ ☐ 封面  标题 / 摘要            频道 优先级  时间   操作  │
│ 资源       │ ☐ [图] 双十一活动通知…         产品  高     11-17   ⋯    │
│  媒体库    │ ☐ [图] 安全合规更新…           安全  紧急   11-16   ⋯    │
│ 系统       │ ─────────────────────────────────────────────────────── │
│  设置      │ 已选 2 项 [删除]                    共 128 条  [1 2 3 ›] │
│ ◂ 折叠     │                                                          │
└────────────┴──────────────────────────────────────────────────────────┘
```

- **侧栏 240px（折叠 64px）**，固定不滚动，三组：内容（文章列表 / 新建文章 / 批量导入）、资源（媒体库）、系统（设置）。选中态用左侧 3px 品牌竖条 + 浅底。底部固定：折叠、主题切换、`admin` 下拉（退出）。
- **顶栏 56px**：折叠按钮、面包屑、`⌘K` 全局搜索（`Modal` → 跳 `/admin/notices?q=`）、主题切换、用户菜单。
- **内容区**：`max-width 1440`；页头（标题 + 说明 + 右侧主操作）→ 筛选卡 → 数据卡（`variant="borderless"`，antd 6 已废弃 `bordered`）。
- **文章列表**：`Table`（`rowKey="id"`，`scroll={{x: 960}}`）列：多选、封面 48×32、标题 + 摘要两行、频道、优先级 `Tag`、标签、时间、操作（编辑 / 复制链接 / 删除）。筛选条与公开列表同源组件，差异只在 `scope`。批量删除用 `App.useApp()` 的 `modal.confirm`。
- **编辑页**：两栏，左 1fr 右 320。左：标题（≥200 字计数）、摘要、`MarkdownEditor`（`MdEditor` 双栏 + 工具栏，`onUploadImg` 直连上传）、正文预览。右（粘性）：频道 `Select`（可自由输入新值）、优先级 `Segmented`、发布时间 `DatePicker showTime`、标签 `Select mode="tags"`、封面 / 附件 / 作者头像 `MediaPicker`、作者名、`extra` JSON（折叠）。底部：保存（防重复）、取消、离开未保存拦截（`beforeunload` + 路由确认 + `localStorage` 草稿）。
- **媒体库**：拖拽上传（`Upload.Dragger` + `customRequest` 显示进度）、筛选（类型 `Segmented`、格式、关键词）、网格 6/4/2（缩略图 + 名称 + 格式徽标）、分页；hover 出现「复制链接 / 重命名 / 删除」；点击开 `Drawer` 预览（原图、元信息、引用文章）。
- **导入页**：`Steps` 三步。（1）选适配器 + 拖拽文件；（2）预览：统计卡（总/有效/无效）、错误表（前 200）、有效数据前 20 条；（3）确认：统一频道、去重策略（跳过/覆盖）、执行 → 结果报告。**适配器为空时整页空态**，说明「在 `lib/server/import/adapters/` 新增适配器并在 `registry.ts` 注册」并给出接口签名，不做假按钮。
- **设置页**：两个 `Tabs`。
  - 账号：用户名、改密码（旧密码 + 新密码 + 确认 + 强度提示）。
  - 媒体存储：类型 `Radio.Group` 卡片式（六选一），按类型显示字段；密钥 `type="password"`，占位显示「已保存 ••••3f2a」，保存后不回显；「测试连接」调 `/api/admin/settings/storage/test`，返回耗时与结果。
- **会话过期**：任何管理 API 返回 401 → `signOut({ callbackUrl: '/admin/login' })` + toast「登录已过期」。

### 7.4 状态与数据获取

- **URL 是筛选的唯一事实源**（可分享、可刷新、可后退）。`useUrlFilters` 在 antd `Form` ↔ `URLSearchParams` 间双向同步，`router.replace(..., { scroll: false })`，输入 300ms 防抖。
- **`useApiQuery`**：`fetch` + `AbortController` + `loading/error/data/refresh`；不跨页缓存（数据量小，简单可预期）。
- **Zustand `useUIStore`**（`persist`）：`themeMode`、`siderCollapsed`、`noticeView`、`pageSize`。列表数据、表单值、筛选条件不进 store。
- **antd `App`**：`message/modal/notification` 一律走 `App.useApp()`，避开静态方法脱离上下文的警告。
- **表单**：提交前统一 `schema.safeParse`，把 `details` 映射为字段错误；失败不丢表单，按钮防重复。

### 7.5 明暗切换（无闪动）

1. `<html suppressHydrationWarning>` + `data-theme`；`app/layout.tsx` 内联脚本在首帧前读 `localStorage.theme`（无值则 `matchMedia`），同时写 `data-theme` 与 `style.colorScheme`。
2. `ConfigProvider theme={{ algorithm: isDark ? darkAlgorithm : defaultAlgorithm }}` + `locale={zhCN}`；`dayjs.locale('zh-cn')`。
3. 三态 `Segmented`：亮 / 跟随系统 / 暗；`system` 监听 `matchMedia`。
4. antd `colorBgElevated`、`colorBorderSecondary` 等映射到自定义 CSS 变量，弹层与自绘卡片同色。

### 7.6 响应式与可访问性

- 断点：`≥1440` 三列 + 侧栏；`1200–1439` 三列；`768–1199` 两列、侧栏变 `Drawer`；`<768` 单列、后台侧栏 `Drawer`、表格横向滚动。
- 键盘：所有可点元素可 Tab，焦点环 2px 品牌色；`Table` 行操作加 `aria-label`。
- 对比度：正文/次要在两种主题下 ≥ 4.5:1；优先级用「色点 + 文字」，不靠纯色块。
- `MediaImage` 统一 `alt`（媒体 `name` → 文章标题 + 「配图」）；装饰图 `alt=""`。
- `<html lang="zh-CN">`，全站中文与全角标点。

### 7.7 组件清单

`SiteHeader` `SearchBox` `FilterPanel` `ViewSwitch` `NoticeCard` `MasonryGrid` `NoticeListRow` `PaginationBar` `NoticeMeta` `AttachmentList` `PrevNextNav` `AdminSider` `AdminHeader` `AdminShell` `NoticeTable` `NoticeFilterBar` `NoticeForm` `MetaPanel` `MarkdownEditor` `ContentRenderer` `MediaPicker` `MediaGrid` `MediaDetailDrawer` `UploadDragger` `ImportWizard` `AdapterEmpty` `SettingsTabs` `StorageForm` `PasswordForm` `ThemeToggle` `MediaImage` `EmptyState` `ErrorState` `PageHeader` `SectionCard` `StatBadge` `ConfirmDelete`。

---

## 8. 分阶段实施计划

> 每个 Phase 结束：`npm run lint` + `npx tsc --noEmit` + `npm run build` 通过，按你的提交规范单独 commit，然后停下等你确认。

### Phase 1 · 安装依赖（0.5 天）

```bash
npm i antd@^6.7.1 @ant-design/icons@^6.3.4 @ant-design/nextjs-registry@^1.3.0 @ant-design/cssinjs@~2.1.2
npm i next-auth@5.0.0-beta.32
npm i md-editor-rt@^7.1.0 zustand@^5.1.0 zod@^4.6.7 mongoose@^9.12.2
npm i @aws-sdk/client-s3 @vercel/blob @edgeone/pages-blob webdav
npm i sanitize-html clsx dayjs server-only
npm i -D @types/sanitize-html tsx
```

- 校验 `npm ls @ant-design/cssinjs` 只有一份 2.1.x。
- `package.json` 加 `typecheck` 脚本（`seed` / `smoke` 随 P2 / P3 落地）；环境变量表写进 `docs/DEVELOPMENT.md`（`.env*` 同时被 `.gitignore` 与平台安全策略拦截，不落示例文件）。
- 验收：`npm run lint`、`npx tsc --noEmit`、`npm run build` 全绿；首页仍可打开。
- 交付：`package.json` / `package-lock.json` / `docs/DEVELOPMENT.md` / `docs/reference/storage-legacy.md`（示例存储原文留档，原 `lib/storage/*` 已移除，Phase 2 对照它实现）。

### Phase 2 · 数据模型与媒体存储（1.5 天）

- 任务：
  1. 四个模型 `lib/server/models/{notice,media,setting,import-job}.ts`（索引、虚拟 `id`、`toJSON` 不吐 `_id`/`__v`，**不开 timestamps**）。
  2. `lib/server/dto.ts`：`_id→id`、摘要派生、按 scope 裁剪。
  3. `lib/media.ts`：六种适配器 + `loadMediaConfig/saveMedia/readMedia/removeMedia/mediaUrl`；对照 `docs/reference/storage-legacy.md` 实现（原 `lib/storage/*` 已在 Phase 1 移除）。
  4. `lib/db.ts` 保留，加 `import 'server-only'` 与更清楚的连接失败提示。
  5. `scripts/seed.ts`：upsert Setting（默认密码取 `ADMIN_INIT_PASSWORD`，缺省用约定值）、样例频道 + 8 篇样例文章 + 1 个 base64 示例媒体；幂等。
- 验收：`npm run seed` 成功、集合与索引创建、重复跑不重复插入；`npx tsc --noEmit` 通过。
- 交付：模型、媒体单文件、DTO、seed。

### Phase 3 · 后端 API 与契约文档（3 天）

- 任务：`lib/shared/contracts/*`（Zod 全量）、`respond.ts` / `errors.ts`、`guard.ts`、`auth.ts` + `proxy.ts`、`app/api/auth/[...nextauth]/route.ts`、公开端点（notices 列表/详情、channels、tags、media）、管理端点全集（§5.3，无 logs / bootstrap）、限流、导入解析/确认（注册表为空）、`/api/media/[id]`、`scripts/smoke-api.ts`。
- 验收：`npm run smoke` 覆盖「未登录 401 → 登录 → 列表筛选/分页 → 新建/改/删 → 上传/取图/删（base64）→ 设置读写与脱敏 → 导入空注册表友好报错 → 改密后旧会话 401」。
- 交付：`docs/API-CONVENTIONS.md`、`docs/DATA-MODELS.md`、全部 API。

### Phase 4 · 前端基座（2 天）

- 任务：`globals.css` 分层与令牌、`AppProviders`（AntdRegistry + ConfigProvider zhCN + 双算法 + App + SessionProvider）、防闪脚本、Zustand store、api 客户端与 hooks、站点/后台外壳、通用组件、移除 `next/font`。
- 验收：`/` 与 `/admin/login` 可渲染；主题三态无闪动、刷新保持；无 antd 6 废弃 API 警告；`npm run build` 通过（`cacheComponents` 校验无 Suspense 报错）。
- 交付：`docs/FRONTEND-SPEC.md`、令牌与外壳。

### Phase 5 · 访客站点（2 天）

- 任务：列表页（三视图 + 筛选 + 搜索 + 排序 + 分页 + URL 同步 + 骨架/空/错误）、详情页（双通道渲染 + 目录 + 附件 + 上下篇 + 复制链接）、顶栏、404/错误页、响应式与 a11y。
- 验收：浏览器验收（magpie-browser MCP，不写 Playwright）：1440/1024/390 三档明暗各一遍；筛选组合与请求参数一致；空结果与断网有正确状态；Markdown/HTML 两种正文都正常、目录锚点可跳。
- 交付：站点页面与组件。

### Phase 6 · 管理后台（4 天）

- 任务：登录与 401 处理、侧栏外壳、文章列表（筛选/排序/批量删/复制链接）、编辑页（md-editor-rt + 媒体选择 + 校验 + 未保存拦截）、媒体库（上传/筛选/网格/重命名/删除/引用提示/预览）、导入向导与空态、设置（账号 / 媒体存储）。
- 验收：后台全链路（登录 → 新建带封面与附件的文章 → 前台可见 → 编辑 → 删除）；上传 base64 全链路 + 其余类型各点一次「测试连接」并记录；改密后旧会话被踢；刷新后台保持登录。
- 交付：后台页面与组件。

### Phase 7 · 收尾（1 天）

- 任务：全站响应式与 a11y 复核、`docs/DEVELOPMENT.md` 补部署与备份、README 重写、`docs/FRONTEND-SPEC.md` 补「antd 6 废弃 API 对照表」、最终 `lint/build/smoke`。
- 验收：§12 逐条打勾。

**总估时**：约 13 人天（不含你准备凭证与样例数据的时间）。

---

## 9. 规范文档交付

| 文件 | 内容 | 阶段 |
| :--- | :--- | :--- |
| `docs/IMPLEMENTATION-PLAN.md` | 本文件 | ✅ |
| `docs/DATA-MODELS.md` | 集合字段、索引、约束、`id` 映射、seed 与默认密码 | P2 |
| `docs/API-CONVENTIONS.md` | envelope、错误码、分页/筛选、鉴权、端点全集与 curl 示例 | P3 |
| `docs/FRONTEND-SPEC.md` | 令牌、断点、组件 props、antd 6 用法约定、a11y 清单 | P4 |
| `docs/DEVELOPMENT.md` | 环境变量、脚本、目录约定（含「每个 ts 文件首行写路径注释」）、Vercel 部署 | P1 起 |
| `docs/reference/storage-legacy.md` | 媒体存储示例原文留档（Phase 2 对照） | ✅ |

写作规则沿用你的协作约定：注释只在关键处、单行、紧贴代码上方；文件首行路径注释；不写文档化注释与分隔行。

---

## 10. 已裁决事项（无待确认项）

| 问题 | 结论 |
| :--- | :--- |
| `meta.type` 六值 | 删除，固定 `article` |
| `channel` 结构 | 字符串，`distinct` 聚合导航 |
| 是否还有别的数据模型 | 没有，就你给的这两个（通知 / 媒体） |
| 媒体类型 | 六值，含 `webdav` |
| 辅助字段 | 不加；Notice 用 `meta.timestamp`，Media 用 `_id` 倒序 |
| `sanitize-html` | 允许 |
| 日志 / 互动 | 全部移除；`interaction` 仅保留字段与默认值 |
| 初始化 | seed 建 Setting + 默认密码，登录后自改 |
| SEO | 不做，不自用公开 |
| 品牌 / 页脚 / 图标 | 站名写死、无页脚、沿用 `vercel.svg` |
| 部署 | Vercel |

**执行时仅需你顺手确认的两件小事**（不阻塞开工）：
1. 站名占位用「通知中心」，想换就是 `lib/shared/constants.ts` 里一行。
2. 默认密码以 `ADMIN_INIT_PASSWORD` 环境变量为准，未设时用你给的值；`.env.example` 只写占位，不写明文。

---

## 11. 风险与对策

| 风险 | 影响 | 对策 |
| :--- | :--- | :--- |
| `cacheComponents` 校验对客户端页 + `useSearchParams` 报错 | 构建失败 | 读 URL 的子树包 `<Suspense fallback={骨架}>`；P4 第一件事验证 |
| antd 6 与 `@ant-design/cssinjs` 版本错位 | 首屏无样式/双实例 | Phase 1 锁 `~2.1.2` 并 `npm ls` 校验 |
| next-auth beta 与 `proxy.ts` 行为差异 | 门禁失效 | `requireAdmin()` 在每个管理 API 二次校验；P3 用 curl 直接打未授权接口 |
| md-editor-rt 7 的 SSR / CSS 导入 | 构建或水合报错 | 统一 `dynamic(..., { ssr:false })` + 客户端组件内 `import 'md-editor-rt/lib/style.css'` |
| Vercel 4.5 MB 请求体上限 | 大文件上传失败 | 前端预检 + 服务端 4 MB 硬限；提示改用对象存储类型 |
| base64 媒体撑大文档 | Mongo 16 MiB 限制 | 单文件 512 KiB；文档推荐生产用 r2/vercel/webdav/edgeone |
| `url` 类型代理被用作 SSRF 跳板 | 内网探测 | 私网/回环拒绝 + 手动重定向 + 8s 超时 + 20 MiB 上限 |
| 中文模糊搜索走正则 | 数据量大变慢 | 现量级可接受；上量换 Atlas Search（阈值写进文档） |
| 无审计日志（D10） | 误删无法追溯 | 删除操作二次确认 + 媒体引用检查；如需追溯再加，不改模型 |
| 默认密码进仓库 | 凭证泄露风险 | 只用环境变量，`.env.example` 写占位；首次登录强制提示改密 |
| 单管理员并发编辑 | 后写覆盖先写 | 自用场景接受；编辑页保存前提示「内容已被更新」需额外版本字段，本期不加 |

---

## 12. Definition of Done

- [ ] `npm run lint`、`npx tsc --noEmit`、`npm run build` 全绿，控制台无 antd 6 废弃 API 警告。
- [ ] `npm run smoke` 全绿；未授权访问 `/api/admin/**` 返回 envelope 401。
- [ ] 访客列表三视图、全部筛选条件、排序、分页、空态、错误态、骨架屏可用，URL 可分享可回退。
- [ ] 详情页 Markdown 与 HTML 正文均正确渲染，HTML 已净化（注入 `<script>` 无效），目录可跳转，附件可下载。
- [ ] 后台完成「登录 → 新建 → 前台可见 → 编辑 → 删除」全链路；媒体上传/预览/复制链接/删除可用，被引用时有提示。
- [ ] 媒体只经 `/api/media/{id}` 暴露，任何响应体都不出现原始 `src`。
- [ ] 导入页在空注册表下给出明确空态与接入说明，导入接口就绪。
- [ ] 设置页可改密码（旧会话失效）与存储配置（密钥脱敏回显、测试连接可用）。
- [ ] 明暗双主题在访客站与后台均无闪动；1440/1024/390 三档布局正确。
- [ ] 全部非根目录 ts 文件首行有路径注释；无行内注释、无多行注释、无文档化注释。
- [ ] 每个 Phase 一个 `feat:` 提交，描述为 `- ` 开头的要点行；无格式化噪音与弃用 API。

---

## 13. 开工顺序

1. **Phase 1**：装依赖 + `.env.example` + 脚本 + 文档骨架 → 提交 → 停。
2. **Phase 2**：四个模型 + `lib/media.ts` + DTO + seed（含默认密码）→ 提交 → 停。
3. **Phase 3–7**：按 §8 推进，每个 Phase 结束停下等你验收。

---

## 14. 实施进度（已全部落地）

| 阶段 | 状态 | 说明 |
| :--- | :--- | :--- |
| Phase 1 依赖安装 | ✅ | 依赖、`typecheck`/`seed`/`smoke` 脚本、开发文档 |
| Phase 2 数据模型与媒体 | ✅ | 四个模型、`lib/media.ts` 六适配器、DTO、seed（默认密码见 `lib/shared/constants.ts`，可用 `ADMIN_INIT_PASSWORD` 覆盖） |
| Phase 3 后端 API | ✅ | 统一 envelope、Zod 合约、next-auth + `proxy.ts`、全部端点、冒烟脚本 |
| Phase 4 前端基座 | ✅ | 设计令牌、Provider、主题三态、外壳、取数 hooks |
| Phase 5 访客站点 | ✅ | 三视图列表、筛选与 URL 同步、详情双通道渲染、目录、附件、上下篇 |
| Phase 6 管理后台 | ✅ | 登录、文章列表/编辑、媒体库、导入向导（空注册表）、设置 |
| Phase 7 收尾 | ✅ | 数据模型/API/前端规范文档、README、lint/typecheck/build 全绿 |

### 实施中的偏差与处理

1. **antd cssinjs 与 Cache Components 冲突**：`@ant-design/cssinjs` 在模块初始化调用 `Math.random()`，预渲染期被拦截。处理：`app/layout.tsx` 用 `<Suspense>` 包住 Provider，页面转为 Partial Prerender（列表/详情/编辑页为动态洞），首屏仍在服务端产出。
2. **存储示例留档已删除**：按你的要求不再保留 `docs/reference/storage-legacy.md`，能力直接收敛进 `lib/media.ts`。
3. **编辑页离开拦截**：只做 `beforeunload`，未做路由级拦截（Next App Router 无稳定路由事件），换取实现确定性。
4. **媒体 HEAD**：为返回准确 `Content-Length` 会读取一次文件；大文件场景后续可改为只查元数据。
5. **未加 `server-only` 到模型层**：seed/smoke 脚本用 tsx 直接引用模型，加了会因 `server-only` 抛错；边界改由目录约定与代码评审保证。
6. **冒烟需真实环境**：`npm run smoke` 需要运行中的服务、已 seed 的数据库与 `SMOKE_ADMIN_PASSWORD`。
7. **构建需 `AUTH_SECRET`**：Vercel 项目环境变量里配置一次即可。
