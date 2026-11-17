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
| POST | `/api/admin/media` | `multipart/form-data`，字段 `file`、可选 `author` |
| PATCH | `/api/admin/media/{id}` | `{ name?, author? }` |
| DELETE | `/api/admin/media/{id}` | `?force=1` 忽略引用检查 |
| GET | `/api/admin/import/adapters` | 已注册适配器，本期为 `[]` |
| POST | `/api/admin/import/parse` | `multipart/form-data`：`adapter` + `file` → 预览 |
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
