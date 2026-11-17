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
| `npm run seed` | 初始化 `Setting`（管理员密码、存储配置）与样例文章、示例媒体；已存在则跳过 |
| `npm run smoke` | API 冒烟，需要服务在跑且已 seed，见下方环境变量 |
| `npm run admin:check -- <密码>` | 校验数据库连接、单例设置与管理员密码是否匹配 |

## 环境变量

在仓库根创建 `.env.local` 或 `.env`（两者都被 `.gitignore` 的 `.env*` 忽略，不要提交；同时存在时 `.env.local` 优先）。`next dev/build` 会自动读取；`seed` / `smoke` / `admin:check` 由 npm 脚本里的 Node 原生 `--env-file-if-exists` 参数注入，脚本内只读 `process.env`。

| 变量 | 必填 | 说明 |
| :--- | :--- | :--- |
| `MONGODB_URI` | ✔ | 形如 `mongodb+srv://user:pass@cluster/notice`；不写库名时默认 `notice` |
| `AUTH_SECRET` | ✔ | next-auth JWT 签名密钥，用 `openssl rand -base64 32` 生成 |
| `AUTH_URL` | 本地 ✔ | `http://localhost:3000`；Vercel 上可留空，由请求头推断 |
| `ADMIN_INIT_PASSWORD` | 首次 seed ✔ | 初始化管理员密码，缺省值见 `lib/shared/constants.ts`；仅 seed 使用，不参与运行时逻辑 |
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
npm run seed        # 自动读取根目录 .env.local（存在时）
npm run dev
```

`seed` 会在 `notices` 为空时写入 8 篇样例文章和 2 个 base64 示例媒体，并创建 `settings/singleton`。初始管理员用户名 `admin`，密码取 `ADMIN_INIT_PASSWORD`，未设置时使用默认值；**首次登录后请到「设置 → 账号」修改**。

## 媒体存储

六种类型：`base64`、`url`、`r2`、`vercel`、`webdav`、`edgeone`。全部实现在 `lib/media.ts`，对外只经 `/api/media/{id}`。

- 默认 `base64`，单文件上限 512 KiB（Mongo 单文档 16 MiB 限制内）。
- 其余类型凭证在后台「设置 → 媒体存储」填写，存 `Setting`，接口只回掩码。
- 全局上传上限 4 MiB（Vercel 函数请求体约 4.5 MiB）；大文件请改用对象存储类型。

## Vercel 部署要点

1. 项目环境变量配置 `MONGODB_URI`、`AUTH_SECRET`；`AUTH_URL` 可留空。
2. Atlas 网络访问需允许 Vercel 出口，通常加 `0.0.0.0/0` 并按数据库用户密码约束。
3. `npm run seed` 在**本地**对线上库执行一次即可，不要挂到构建流程里。
4. 函数实例无状态：导入暂存已落库，登录限流为实例内存级弱限流。
5. 媒体响应带长效缓存头与 ETag，Vercel 边缘会直接命中，不经过数据库。

## 常见问题

| 现象 | 处理 |
| :--- | :--- |
| `请在 .env 文件中定义 MONGODB_URI` | 根目录缺 `.env.local` 或变量名为空 |
| 登录后立刻 401 | `AUTH_SECRET` 变更过，或 `Setting.admin.sessionVersion` 被改密递增 |
| 登录提示用户名或密码不正确 | 先跑 `npm run admin:check -- <密码>`：库连不上、未 seed、密码不匹配会被逐个指出；连续失败 5 次会触发 10 分钟限流，重启服务可立即清除 |
| 首屏 antd 组件无样式 | 确认 `app/layout.tsx` 内 `AntdRegistry` 包裹在 `ConfigProvider` 外层 |
| 构建报 `useSearchParams` 需 Suspense | 读取 URL 参数的客户端子树必须包 `<Suspense>` |
| 媒体上传 413 | 超过 4 MiB 或平台请求体上限，改用 r2/vercel/webdav/edgeone |
| 页面数据为空但接口有数据 | 检查 `/api/**` 的 envelope 解包与 `page/pageSize` 默认值 |
