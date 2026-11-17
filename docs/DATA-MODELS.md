# 数据模型

所有集合由 Mongoose 定义，位于 `lib/server/models/`。对外 JSON 一律 `id`（字符串），内部 `_id`（ObjectId）；时间统一 Unix 秒整数。

## 集合一览

| 集合 | 模型文件 | 用途 |
| :--- | :--- | :--- |
| `notices` | `notice.ts` | 文章/通知 |
| `media` | `media.ts` | 媒体（图片、附件） |
| `settings` | `setting.ts` | 单例配置（管理员密码、存储配置） |
| `import_jobs` | `import-job.ts` | 导入暂存（过程数据，2 小时 TTL） |

## notices

| 字段 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `meta.type` | string | ✔ | 固定 `article` |
| `meta.channel` | string | ✔ | 频道名，字符串，不做集合引用 |
| `meta.priority` | enum | ✔ | `urgent / high / normal / low`，默认 `normal` |
| `meta.timestamp` | number | ✔ | 发布时间（秒），列表排序与时间筛选依据 |
| `content.title` | string | ✔ | ≤ 200 字 |
| `content.summary` | string | ✘ | 空则保存时自动取正文前 120 字 |
| `content.body` | string | ✘ | Markdown 或 HTML，原样存储 |
| `content.author` | object | ✘ | `{ name?, avatar? }`，`avatar` 为媒体 id |
| `content.cover` | string | ✘ | 媒体 id |
| `content.tags` | string[] | ✘ | 去重，最多 8 个 |
| `content.entities` | string[] | ✘ | 媒体 id 列表，即附件 |
| `interaction` | object | ✔ | `{ views: [], likes: [], comments: [] }`，接口不读写，默认空数组 |
| `extra` | Mixed | ✘ | 业务自定义 JSON，管理端可编辑 |

索引：`meta.timestamp`、`meta.channel + meta.timestamp`、`meta.priority + meta.timestamp`、`content.tags + meta.timestamp`。

不落库：`meta.status`、`meta.expirein`（本项目不处理），也不加 `createdAt/updatedAt`。

搜索：中文全文索引不可用，改为 `title/summary` 正则（转义后大小写不敏感）。数据量超过 10 万建议换 Atlas Search。

## media

| 字段 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `type` | enum | ✔ | `base64 / url / r2 / vercel / webdav / edgeone` |
| `src` | string | ✔ | 适配器内部标识；**任何接口都不下发** |
| `format` | string | ✔ | 小写扩展名，白名单见设置 |
| `name` | string | ✘ | 展示名 |
| `author` | object | ✘ | `{ name?, avatar? }` |

索引：`type + _id`。

- 排序用 `_id` 倒序（ObjectId 含时间），不加 `createdAt`。
- 文件大小只在**上传响应**中返回，不落库。
- 删除前用 `content.cover / content.entities / content.author.avatar / content.body` 反查引用，命中返回 409 与引用列表，`?force=1` 可强制删除。

## settings

`_id` 固定为字符串 `singleton`。

| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `admin.username` | string | 默认 `admin` |
| `admin.passwordHash` / `admin.passwordSalt` | string | scrypt（N=16384, r=8, p=1），16 字节盐 |
| `admin.passwordUpdatedAt` | number | 秒 |
| `admin.sessionVersion` | number | 改密后 +1，旧 JWT 立即失效 |
| `media.type` | enum | 默认 `base64` |
| `media.maxUploadSize` | number | 默认 4 MiB（Vercel 请求体上限） |
| `media.allowedFormats` | string[] | 默认 png/jpg/jpeg/webp/gif/svg/pdf/zip/docx/xlsx/mp4 |
| `media.vercelToken` 等凭证字段 | string | 按类型取用；接口只回 `set + 末四位掩码` |

初始化：`npm run seed` 写入该文档。默认密码在 `lib/shared/constants.ts` 的 `DEFAULT_ADMIN_PASSWORD`，可用环境变量 `ADMIN_INIT_PASSWORD` 覆盖；已有文档时不会覆盖密码。**首次登录后请立即在「设置 → 账号」修改。**

## import_jobs

| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `adapter` | string | 适配器 id |
| `filename` / `mime` / `size` | string / string / number | 上传文件信息 |
| `status` | enum | `parsed / committed` |
| `total` / `validCount` / `invalidCount` | number | 统计 |
| `invalid` | array | `{ index, path, message }`，最多 200 条 |
| `payload` | Mixed[] | 已通过 Zod 的待写入数据 |
| `createdAt` / `expiresAt` | Date | TTL 索引 `expireAfterSeconds: 0`，2 小时过期 |

暂存落库而非内存：Vercel 无实例亲和，预览与确认可能落在不同实例。

## 字段映射与裁剪

- `toId(doc)` = `String(_id)`；入口先用 `^[0-9a-fA-F]{24}$` 校验，非法直接 400。
- 列表 DTO 不含 `body / extra / interaction`；详情 DTO 含 `body / entities / attachments`，不含 `interaction`。
- 公开详情：`bodyFormat` 为 `html` 时，正文经 `sanitize-html` 白名单净化后返回；管理端返回原始正文供编辑器使用。
- 媒体 DTO 只给 `{ id, type, format, name, author, url }`，`url` 恒为 `/api/media/{id}`。
