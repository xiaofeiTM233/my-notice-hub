# API 约定

所有接口位于 `app/api/**/route.ts`，统一由 `lib/server/respond.ts` 的 `withApi` 包裹。请求/响应形状定义在 `lib/shared/contracts/`（Zod）。

## 响应 envelope

```json
{ "ok": true, "data": {}, "meta": { "requestId": "…", "tookMs": 12 } }
```

```json
{
  "ok": false,
  "error": { "code": "VALIDATION_FAILED", "message": "请求参数校验失败", "details": [] },
  "meta": { "requestId": "…", "tookMs": 3 }
}
```

- 响应头固定带 `x-request-id`，排错时把它和 Vercel 日志一起看。
- 失败时 HTTP 状态码与 `error.code` 同时正确。

| code | HTTP | 场景 |
| :--- | :--- | :--- |
| `BAD_REQUEST` | 400 | 参数缺失、id 非法、JSON 不合法 |
| `VALIDATION_FAILED` | 422 | Zod 校验失败，`details` 为 `{ path, message }[]` |
| `UNAUTHORIZED` | 401 | 未登录、会话版本失效 |
| `NOT_FOUND` | 404 | 文章/媒体不存在 |
| `CONFLICT` | 409 | 媒体被引用 |
| `RATE_LIMITED` | 429 | 登录尝试超限 |
| `STORAGE_ERROR` | 502 | 存储适配器失败 |
| `UPSTREAM_ERROR` | 502 | `url` 类型代理失败 |
| `INTERNAL` | 500 | 兜底，详情只进服务端日志 |

## 鉴权

- `POST /api/auth/callback/credentials`（Auth.js）→ JWT 会话，12 小时。
- `proxy.ts` 拦截 `/admin/**` 与 `/api/admin/**`：页面未登录跳 `/admin/login?next=…`，接口返回 401 envelope。
- 每个管理接口内部还会调用 `requireAdmin()`，校验 `session.sv === Setting.admin.sessionVersion`。

## 列表查询参数

| 参数 | 说明 |
| :--- | :--- |
| `q` | 标题/摘要关键词，≤ 80 字 |
| `channel` | 可重复，多选频道 |
| `priority` | 可重复，`urgent/high/normal/low` |
| `tag` | 可重复，要求全部命中 |
| `from` / `to` | Unix 秒，闭区间 |
| `sort` | `newest`（默认）/ `oldest` |
| `page` / `pageSize` | 默认 1 / 12，`pageSize` 上限 60 |

响应 `data: { items, total, page, pageSize }`。

## 端点

### 公开

| 方法 | 路径 | 返回 |
| :--- | :--- | :--- |
| GET | `/api/notices` | `{ items: NoticeSummary[], total, page, pageSize }` |
| GET | `/api/notices/{id}` | `NoticeDetail & { prev, next, attachments }` |
| GET | `/api/channels` | `{ channel, count }[]` |
| GET | `/api/tags?limit=60` | `{ tag, count }[]` |
| GET/HEAD | `/api/media/{id}` | 文件字节；`?download=1` 附件下载；支持 `If-None-Match` |

媒体响应头：`Content-Type`、`Content-Length`、`ETag: "m-{id}"`、`Content-Disposition`、`Cache-Control`（base64/对象存储 `max-age=31536000, immutable`，`url` 类型 `max-age=3600`）、`X-Content-Type-Options: nosniff`、`Content-Security-Policy: default-src 'none'`。

### 管理（需登录）

| 方法 | 路径 | 说明 |
| :--- | :--- | :--- |
| GET | `/api/admin/notices` | 同公开列表，附带管理端字段 |
| POST | `/api/admin/notices` | 新建，body 见下方 |
| GET | `/api/admin/notices/{id}` | 编辑用完整数据（含原始正文与 `extra`） |
| PATCH | `/api/admin/notices/{id}` | 局部更新，字段缺省不动，空串清空 |
| DELETE | `/api/admin/notices/{id}` | 删除 |
| POST | `/api/admin/notices/batch` | `{ ids: string[] }`，最多 100 |
| GET | `/api/admin/media` | `q / type / format / page / pageSize` |
| POST | `/api/admin/media` | `multipart/form-data`，字段 `file`、可选 `author`；同内容复用已有媒体并回 `deduped: true` |
| PATCH | `/api/admin/media/{id}` | `{ name?, author? }` |
| DELETE | `/api/admin/media/{id}` | `?force=1` 忽略引用检查 |
| GET | `/api/admin/import/adapters` | 已注册适配器：`zmd`（聚合接口）、`zmd-web`（官网公告）、`gamekee-ba`（蔚蓝档案活动） |
| POST | `/api/admin/import/parse` | `multipart/form-data`：`adapter` + `file` → 预览；远程适配器可省略 `file` |
| POST | `/api/admin/import/commit` | `{ jobId, channel?, duplicate: 'skip' \| 'overwrite' }` |
| GET | `/api/admin/settings` | 脱敏后的设置 |
| PATCH | `/api/admin/settings` | `{ admin?: { username }, media?: { type, maxUploadSize, allowedFormats, credentials } }` |
| POST | `/api/admin/settings/password` | `{ currentPassword, newPassword }` |
| POST | `/api/admin/settings/storage/test` | `{ type? }`，写入并读回 1×1 PNG |

### 文章请求体

```json
{
  "channel": "产品",
  "priority": "normal",
  "timestamp": 1734567890,
  "title": "标题",
  "summary": "可选",
  "body": "## Markdown 或 HTML",
  "author": { "name": "作者", "avatar": "媒体 id" },
  "cover": "媒体 id",
  "tags": ["标签"],
  "entities": ["媒体 id"],
  "extra": { "source": "import" }
}
```

`timestamp` 省略时取服务器当前时间；`summary` 为空时保存阶段自动派生。

### 终末地公告导入（adapter=zmd）

- **取数**：不传文件时实时请求 `https://game-hub.hypergryph.com/bulletin/v2/aggregate?code=endfield_5SD9TN&type={0|1|2}&hideDetail=0`，三个频道并发拉取后合并；接口业务码非 0 或请求失败时返回 502。
- **离线导入**：也接受 `/bulletin/v2/aggregate` 的 JSON 响应导出，支持单条响应、多条响应数组、`data.list` 或公告条目数组；带 `cid` 的条目按 cid 去重，优先保留含 `data.html` 的版本。
- **映射**：`channel` 固定 `zmd`，`author.name` 固定 `终末地·游戏`，`timestamp` 取 `startAt`，优先级统一 `normal`（`focus` 只记进 `extra`）。
- **正文**：`rich_text` 取 `data.html`；`picture` 用 `data.url` 拼图片、`data.link` 拼“查看活动详情”外链。
- **封面**：`picture` 公告用配图作封面并从正文移除；`rich_text` 公告接口不给封面，取正文首图作封面，正文保留原图。
- **附加**：`header` 与标题不同时记为摘要，`tab` 转成标签（活动公告/资讯速报/游戏公告/云端），`extra` 保留 `cid / type / tab / displayType / linkType`；导入时带 `extra.source + extra.cid` 的文章按来源标识判重。
- **图片**：导入预览阶段不处理图片；确认导入时把列表 `cover` 与正文图片登记为外链媒体（`type: url`），正文改写为 `/api/media/{id}`，图片公告的配图额外作为封面。登记时先按地址、再按图片字节的 SHA-256 查重，同一张图换个路径也会复用同一条媒体；单张登记失败退化为按地址去重，不阻断导入。
- **历史归档**：`npm run import:zmd-archive` 直接读 [endfield-archive-library](https://github.com/BiologyHazard/endfield-archive-library) 的 `bulletin/detail`，复用本适配器的映射与图片登记，默认覆盖同 `cid` 条目。

### 终末地官网公告导入（adapter=zmd-web）

- **取数**：列表 `https://web-news.hypergryph.com/api/bulletin?lang=zh-cn&code=endfield_web&page=n&pageSize=20` 按 `total` 翻页，再逐条请求 `/api/bulletin/{cid}?lang=zh-cn&code=endfield_web` 取正文 HTML（并发 6，单条失败只丢正文）。
- **映射**：`channel` 固定 `zmd`，`tags` 固定 `终末地·官网`，`author.name` 固定 `终末地·游戏`，`timestamp` 取 `displayTime`，优先级统一 `normal`（置顶 `sticky` 只记进 `extra`），`summary` 取 `brief`，`extra` 保留 `cid / tab / sticky`。
- **图片**：列表 `cover` 与正文图片同样登记为外链媒体；封面图同时出现在正文时从正文移除，避免详情页重复。

### 蔚蓝档案活动导入（adapter=gamekee-ba）

- **取数**：`https://www.gamekee.com/v1/activity/page-list?sort=-1&limit=N&page_no=P`，请求头 `game-alias: ba`、`Lang: zh-cn`。向导默认最近 50 条用于日常增量，全量用 `npm run import:gamekee-ba`（默认 5000，按页翻完）。
- **上限**：该接口单次最多 999 条，且服务端只保留最近 999 条（`total` 恒为 999，`page_total` 与 `limit` 相乘不超过 999，升序与降序返回同一批 id，早于 2025-02-19 的记录关键词也搜不到）。适配器会按 `page_total` 翻页，翻到底仍只有 999 条；2021~2024 年的活动只存在于 wiki 文档「日服往期活动一览」，本适配器不覆盖。
- **映射**：`channel` 固定 `ba`，`author.name` 固定 `蔚蓝档案`，`timestamp` 取 `begin_at`，优先级统一 `normal`；`summary` 优先取 `description`，缺省时写成活动时间；正文为活动时间、描述段落与「查看活动详情」外链。
- **标签**：`蔚蓝档案·{pub_area}` 与 `activity_kind_name` 各成一个标签，例如 `蔚蓝档案·日服`、`战术测试`。
- **图片**：`picture`（协议相对地址补成 https）登记为外链媒体，媒体记录 `referer: https://www.gamekee.com/`，GameKee 图床缺来源页会返回 567。
- **判重**：`extra.source=gamekee-ba` 加 `extra.cid`（接口 id），重复导入覆盖同一条。

## curl 示例

```bash
# 公开列表
curl 'http://localhost:3000/api/notices?channel=产品&priority=high&page=1&pageSize=12'

# 登录（先取 CSRF）
curl -c jar.txt http://localhost:3000/api/auth/csrf
curl -b jar.txt -c jar.txt -X POST http://localhost:3000/api/auth/callback/credentials \
  -H 'content-type: application/x-www-form-urlencoded' \
  --data 'csrfToken=<token>&username=admin&password=<password>&json=true'

# 上传媒体
curl -b jar.txt -F file=@cover.png http://localhost:3000/api/admin/media

# 读取媒体
curl -I http://localhost:3000/api/media/<id>
```

完整的自动化验证见 `scripts/smoke-api.ts`（`npm run smoke`）。
