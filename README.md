# my-notice-hub

通知公告聚合站。访客可以浏览列表与详情，管理员在后台维护文章、导入数据、管理媒体与站点设置。

前后端严格分离：页面只通过 `/api/**` 取数，后端是 Route Handlers + Mongoose，页面层不引用任何数据库模型。

## 技术栈

| 层 | 选型 |
| :--- | :--- |
| 框架 | Next.js 16（App Router / Turbopack / Cache Components）+ React 19 |
| UI | Ant Design 6（中文包）+ Tailwind 4（仅布局工具类） |
| 认证 | next-auth 5（Credentials + JWT，单管理员） |
| 数据 | MongoDB + Mongoose 9，Zod 合约 |
| 状态 | Zustand（主题、侧栏、列表视图） |
| 编辑器 | md-editor-rt（Markdown 编辑与预览） |
| 媒体 | base64 / url / r2 / vercel / webdav / edgeone，统一经 `/api/media/{id}` 访问 |

## 快速开始

```bash
npm install
npm run seed     # 首次：初始化设置与样例数据（读取 .env.local）
npm run dev      # http://localhost:3000
```

需要 `.env.local` 或 `.env`（已被 Git 忽略，`seed` 等脚本也会读取）：

```
MONGODB_URI=mongodb+srv://...
AUTH_SECRET=...            # openssl rand -base64 32
AUTH_URL=http://localhost:3000
ADMIN_INIT_PASSWORD=...    # 仅 seed 使用，可省略
```

后台入口 `/admin/login`，初始用户名 `admin`。默认密码在 `lib/shared/constants.ts`，首次登录后请在「设置 → 账号」修改。

## 脚本

| 命令 | 作用 |
| :--- | :--- |
| `npm run dev` | 开发服务 |
| `npm run build` | 生产构建（构建时需提供 `AUTH_SECRET`） |
| `npm run start` | 启动构建产物 |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript 检查 |
| `npm run seed` | 初始化设置与样例数据，幂等 |
| `npm run smoke` | API 冒烟（需服务在跑且已 seed） |
| `npm run import:zmd-archive` | 从 GitHub 归档库导入终末地游戏内公告，详见 `docs/DEVELOPMENT.md` |
| `npm run import:gamekee-ba` | 导入 GameKee 蔚蓝档案活动，默认全量 999 条 |
| `npm run dedupe:media` | 按内容哈希合并重复媒体并改写引用 |

## 目录

```text
app/
  (site)/        访客列表与详情
  admin/         登录与后台（侧栏 + 顶栏）
  api/           全部后端接口
components/      site / admin / editor / common / providers
hooks/           取数、筛选同步、主题、提交
lib/
  server/        模型、查询、DTO、鉴权、错误与响应
  shared/        Zod 合约、类型、常量、格式化
  client/        fetch 客户端、Zustand store、antd 主题
  media.ts       六种存储适配器（单文件）
proxy.ts         会话门（Next 16 的 proxy）
auth.ts          next-auth 配置
scripts/         seed、冒烟与归档导入
docs/            计划、数据模型、API、前端、开发部署
```

## 文档

- [实现计划](docs/IMPLEMENTATION-PLAN.md)
- [数据模型](docs/DATA-MODELS.md)
- [API 约定](docs/API-CONVENTIONS.md)
- [前端规范](docs/FRONTEND-SPEC.md)
- [开发与部署](docs/DEVELOPMENT.md)
