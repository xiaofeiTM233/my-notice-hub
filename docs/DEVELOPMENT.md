# 开发与部署

面向本仓库的日常操作说明。实现规划见 `docs/IMPLEMENTATION-PLAN.md`。

## 环境要求

| 项 | 要求 |
| :--- | :--- |
| Node.js | ≥ 20.19（本机 24.22.3 已验证），Next 16 与 Mongoose 9 的下限 |
| npm | ≥ 10 |
| MongoDB | 本地或 Atlas 均可；未指定库名时默认库 `notice` |

## 命令

| 命令 | 作用 |
| :--- | :--- |
| `npm run dev` | Turbopack 开发服务，默认 `http://localhost:3000` |
| `npm run build` | 生产构建（含 `cacheComponents` 校验） |
| `npm run start` | 启动构建产物 |
| `npm run lint` | ESLint（含 Next 规则） |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run smoke` | API 冒烟，需要服务在跑且站点已初始化，见下方环境变量 |
| `npm run admin:check -- <密码>` | 校验数据库连接、单例设置与管理员密码是否匹配 |
| `npm run import:zmd-archive -- [--dry-run] [--dir <目录>] [--limit N] [--skip-existing]` | 导入 [endfield-archive-library](https://github.com/BiologyHazard/endfield-archive-library) 的 `bulletin/detail` 归档公告 |
| `npm run import:gamekee-ba -- [--limit N] [--dry-run] [--skip-existing]` | 导入 GameKee 蔚蓝档案活动列表（频道 `ba`），默认按页翻完全部 999 条 |
| `npm run dedupe:media -- [--dry-run] [--limit N]` | 按内容哈希合并重复媒体，并把文章里被合并媒体的引用改指向保留项 |

归档导入默认走 GitHub 的 `contents` 接口列目录、`raw.githubusercontent.com` 逐个下载（失败回退 jsDelivr）；`--dir` 可指向本地克隆的 `https/game-hub.hypergryph.com/bulletin/detail` 目录，避免网络请求。导入复用 `zmd` 适配器的字段映射与图片登记（频道 `zmd`，图转外链媒体），默认按 `extra.source + extra.cid` 覆盖已存在的公告，`--skip-existing` 可改成跳过；`--dry-run` 只解析不写库。

蔚蓝档案活动同理复用 `gamekee-ba` 适配器：导入页默认只拉最近 50 条做增量，首次全量用 `npm run import:gamekee-ba -- --limit 999`；封面登记的媒体带 `referer: https://www.gamekee.com/`，否则图床拒绝访问。

## 每日自动导入

后台「设置 → 自动导入」选择远程适配器、单次条数与判重方式后开启，线上由根目录 `vercel.json` 的 cron 每天 01:00 UTC（北京时间 09:00）调用 `/api/cron/import`；Hobby 套餐按小时精度执行，实际触发落在该小时内。配置 `CRON_SECRET` 后接口只认 `Authorization: Bearer $CRON_SECRET`（Vercel 会自动带上）；未配置时使用进程内随机密钥，并放行带 `vercel-cron/1.0` 与 `x-vercel-cron-schedule` 头的请求，零配置也能运行。

单次只抓未入库来源标识（`extra.source + extra.cid`）的最近 N 条，剩余部分顺延到下一次；首次补齐历史仍用 `npm run import:zmd-archive` 或 `npm run import:gamekee-ba -- --limit 999`。运行期间写 `autoImport.lockAt` 做 5 分钟并发锁，定时与后台「立即运行」不会同时写库。自动导入不保存运行历史，结果只在手动运行的响应里返回。

本地验证：配置 `CRON_SECRET=dev-secret` 后执行 `curl -H "Authorization: Bearer dev-secret" http://127.0.0.1:3000/api/cron/import`，未启用自动导入时应返回 `ran: false`。

## 环境变量

在仓库根创建 `.env.local` 或 `.env`（两者都被 `.gitignore` 的 `.env*` 忽略，不要提交；同时存在时 `.env.local` 优先）。`next dev/build` 会自动读取；`smoke` / `admin:check` 由 npm 脚本里的 Node 原生 `--env-file-if-exists` 参数注入，脚本内只读 `process.env`。

| 变量 | 必填 | 说明 |
| :--- | :--- | :--- |
| `MONGODB_URI` | ✔ | 形如 `mongodb+srv://user:pass@cluster/notice`；不写库名时默认 `notice` |
| `AUTH_SECRET` | ✔ | next-auth JWT 签名密钥，用 `openssl rand -base64 32` 生成 |
| `AUTH_URL` | 本地 ✔ | `http://localhost:3000`；Vercel 上可留空，由请求头推断 |
| `ADMIN_INIT_PASSWORD` | 首次登录 ✔ | 初始化管理员密码，缺省值见 `lib/shared/constants.ts`；只在单例设置尚未创建时读取一次 |
| `CRON_SECRET` | 定时导入 推荐 | `/api/cron/import` 的 Bearer 密钥；未配置时接口用进程内随机密钥兜底，并放行带 Vercel Cron 标记的调度请求 |
| `SMOKE_BASE_URL` | smoke 可选 | 默认 `http://127.0.0.1:3000` |
| `SMOKE_ADMIN_USERNAME` | smoke 可选 | 默认 `admin` |
| `SMOKE_ADMIN_PASSWORD` | smoke ✔ | 冒烟测试登录用的密码 |

```powershell
# Windows PowerShell 生成密钥
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 256 }))
```

## 代码约定

- 每个非根目录的 ts/tsx 文件首行写相对项目根的路径注释，例如 `// lib/media.ts`；移动或重命名文件时同步更新。
- 注释只在关键逻辑、边界条件、特殊处理处写，单行、紧贴代码上方，说明原因而不是复述代码；禁止行内注释、多行注释与文档化注释块。
- 服务端模块（`lib/server/**`、`lib/media.ts`、`lib/db.ts`）首行加 `import 'server-only'`，防止被打进客户端包。
- 页面与组件不 import `lib/server/**`；前端取数一律走 `/api/**`，保证前后端分离边界。
- 一个功能一个提交，标题 `feat: 一句话说明`，描述每行以 `- ` 开头且只写功能要点。
- 页面验证、截图、交互回归使用 magpie-browser MCP；不写临时 Playwright 脚本（仓库自带 `npm run e2e` 属回归套件，不受此限）。

## 首次运行

```bash
npm install
npm run dev
```

打开 `/admin/login` 提交一次登录即完成初始化：服务端发现 `settings/singleton` 不存在时，用用户名 `admin` 与 `ADMIN_INIT_PASSWORD`（未配置则用默认值）写入管理员密码与默认 `base64` 媒体配置，随后按本次提交的值校验。**首次登录后请到「设置 → 账号」修改密码**。仓库不再附带样例文章与示例媒体。

## 媒体存储

六种类型：`base64`、`url`、`r2`、`vercel`、`webdav`、`edgeone`。全部实现在 `lib/media.ts`，对外只经 `/api/media/{id}`。

- 默认 `base64`，单文件上限 512 KiB（Mongo 单文档 16 MiB 限制内）。
- 其余类型凭证在后台「设置 → 媒体存储」填写，存 `Setting`，接口只回掩码。
- 全局上传上限 4 MiB（Vercel 函数请求体约 4.5 MiB）；大文件请改用对象存储类型。

## Vercel 部署要点

1. 项目环境变量配置 `MONGODB_URI`、`AUTH_SECRET`；`AUTH_URL` 可留空。
2. 建议配置 `CRON_SECRET` 作为定时导入密钥；未配置时 `/api/cron/import` 按 Vercel Cron 标记放行，并在「设置 → 自动导入」选择来源后开启开关。
3. Atlas 网络访问需允许 Vercel 出口，通常加 `0.0.0.0/0` 并按数据库用户密码约束。
4. 单例设置由线上环境第一次登录请求自动创建，确保部署环境已配置 `ADMIN_INIT_PASSWORD`，否则会落到默认密码。
5. 函数实例无状态：导入暂存已落库，登录限流为实例内存级弱限流。
6. 媒体响应带长效缓存头与 ETag，Vercel 边缘会直接命中，不经过数据库。

## 常见问题

| 现象 | 处理 |
| :--- | :--- |
| `请在 .env 文件中定义 MONGODB_URI` | 根目录缺 `.env.local` 或变量名为空 |
| 登录后立刻 401 | `AUTH_SECRET` 变更过，或 `Setting.admin.sessionVersion` 被改密递增 |
| 登录提示用户名或密码不正确 | 先跑 `npm run admin:check -- <密码>`：库连不上、设置未初始化、密码不匹配会被逐个指出；连续失败 5 次会触发 10 分钟限流，重启服务可立即清除 |
| 首屏 antd 组件无样式 | 确认 `app/layout.tsx` 内 `AntdRegistry` 包裹在 `ConfigProvider` 外层 |
| 构建报 `useSearchParams` 需 Suspense | 读取 URL 参数的客户端子树必须包 `<Suspense>` |
| 媒体上传 413 | 超过 4 MiB 或平台请求体上限，改用 r2/vercel/webdav/edgeone |
| 页面数据为空但接口有数据 | 检查 `/api/**` 的 envelope 解包与 `page/pageSize` 默认值 |
