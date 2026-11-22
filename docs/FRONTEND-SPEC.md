# 前端规范

## 设计令牌

定义在 `app/globals.css` 的 `:root` 与 `:root[data-theme='dark']`，antd token 在 `lib/client/theme.ts` 映射到同一套值。

| 令牌 | 亮色 | 暗色 | 用途 |
| :--- | :--- | :--- | :--- |
| `--brand` | `#1677FF` | `#1677FF` | 自定义区域主色，与 antd 默认蓝一致 |
| `--bg` | `#F5F5F5` | `#000000` | 页面底色 |
| `--surface` | `#FFFFFF` | `#141414` | 卡片、面板 |
| `--surface-2` | `#FAFAFA` | `#1F1F1F` | 次级容器、代码块 |
| `--surface-3` | `#F0F0F0` | `#262626` | 悬浮与占位 |
| `--border` | `#F0F0F0` | `#303030` | 分割线、卡片描边 |
| `--border-strong` | `#D9D9D9` | `#424242` | 悬停描边 |
| `--text` / `--text-2` / `--text-3` | `rgba(0,0,0,.88)` / `.65` / `.45` | `rgba(255,255,255,.85)` / `.65` / `.45` | 三级文字 |
| `--priority-urgent` 等 | `#FF4D4F` / `#FA8C16` / `#1677FF` / `#8C8C8C` | `#FF7875` / `#FFA940` / `#4096FF` / `#8C8C8C` | 优先级色点 |

- antd 组件走 `theme.defaultAlgorithm` / `darkAlgorithm`，`lib/client/theme.ts` 显式对齐圆角、字重与控件高度：`borderRadius 6`、`borderRadiusLG 8`、`borderRadiusSM 4`、`fontWeightStrong 600`、`controlHeight 32`。
- 自定义区域使用同一套刻度：表面（卡片/面板/封面）8，控件（按钮/输入/缩略图）6，标签与 chip 4，头像 50%。
- 间距：4 的倍数，主用 8 / 12 / 16 / 24 / 32；页面横向留白 24（移动 16）。
- 字体：`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif`；正文 14，列表页标题 24/600，卡片与面板标题 16/600，详情标题 30/600，仅使用 400 / 600 两档字重。
- 阴影取自 antd 的 tertiary / popup 层级，卡片默认平铺，仅在悬停时加轻阴影，不使用位移与图片缩放。
- 自定义可点击元素补齐 `:focus-visible` 焦点环；数字统一 `font-variant-numeric: tabular-nums`；动效统一 200ms，`prefers-reduced-motion` 下关闭动画。

## 布局

- 访客站：`.site-container` 最大 1240；顶栏 64 固定，含品牌标、主题开关与管理入口；列表页 `240px 筛选栏 + 内容`（≥1180 为 208 + 32），≤900 时筛选栏折叠为顶部卡片的横向 chip，卡片列数随 `auto-fill` 自适应。
- 后台：`.admin-shell` 左侧 240（折叠 72）+ 顶部 56；内容区最宽 1440 居中；`<900` 侧栏改为 `Drawer`，表格隐藏封面/标签/时间列并取消横向滚动。
- 编辑页两栏：正文 1fr + 发布设置 300；详情页 `800px 正文 + 240px 目录` 居中，纯 HTML 公告单列居中（<1180 隐藏目录）。

## 主题

1. `app/layout.tsx` 内联脚本在首帧前读本地偏好并写 `data-theme` 与 `color-scheme`。
2. `useThemeMode` 维护 `light/system/dark` 三态，同步 `html[data-theme]` 与 `localStorage`。
3. antd `ConfigProvider` 按 `isDark` 切换 `darkAlgorithm` / `defaultAlgorithm`，`locale=zhCN`。
4. 自定义样式只用 CSS 变量，不用 Tailwind 的 `dark:`，避免两套事实源。

## 数据流

- URL 是筛选的唯一事实源（`useNoticeFilters` + `lib/shared/notice-query.ts`）。
- 取数统一 `useApiQuery`（AbortController + 序列化依赖），写入统一 `useSubmit`（loading + message）。
- 轻量 UI 状态在 `useUIStore`（主题、侧栏折叠、列表视图、每页条数），列表数据与表单值不进 store。
- 页面不 import `lib/server/**`；类型从 `lib/shared/types.ts` 取。

## 组件清单

| 区域 | 组件 |
| :--- | :--- |
| 站点 | `SiteHeader`、`FilterPanel`、`NoticeCard`、`NoticeListRow`、`ViewSwitch`、`PaginationBar`、`NoticeBrowser`、`NoticeDetailView`、`ArticleToc` |
| 编辑器 | `MarkdownEditor`（`MdEditor`，动态加载）、`ContentRenderer`（Markdown / 净化后的 HTML） |
| 后台 | `AdminShell`、`NoticeAdminList`、`NoticeFilterBar`、`NoticeForm`、`MediaPicker`、`MediaLibrary`、`ImportWizard`、`SettingsTabs`、`LoginForm` |
| 通用 | `MediaImage`、`ThemeToggle`、`PageHeader`、`EmptyState`、`ErrorState` |

## antd 6 用法约定

v6 默认使用 CSS 变量，仍用 `@ant-design/nextjs-registry` 抽取首屏样式。**不要使用下列已废弃 API**：

| 组件 | 废弃写法 | 替代 |
| :--- | :--- | :--- |
| `Alert` | `message` | `title` |
| `Card` | `bordered` | `variant` |
| `Card` | `bodyStyle` | `styles.body` |
| `Drawer` | `width` | `size` |
| `Space` | `direction` | `orientation` |
| `Divider` | `type` | `orientation` |
| `Tag` | `bordered={false}` | `variant="filled"` |
| `Modal` | `visible` / `destroyOnClose` | `open` / `destroyOnHidden` |
| `Spin` | `tip` | `description` |
| `Progress` | `width`/`height` 控制尺寸 | `size` |
| `Select` | `popupClassName` | `classNames.popup.root` |
| `Tabs` / `Timeline` / `Anchor` / `Steps` | 子组件写法 | `items` |
| `message` / `modal` / `notification` | 静态方法 | `App.useApp()` 实例 |

## 可访问性

- 所有可点元素可 Tab 聚焦，焦点环 2px 品牌色；图标按钮带 `aria-label`。
- 正文/次要文字在两种主题下对比度 ≥ 4.5:1；优先级用「色点 + 文字」表达，不只靠颜色。
- `MediaImage` 必须有 `alt`；装饰图 `alt=""`。
- `<html lang="zh-CN">`，文案与标点均为中文全角。
- 空态、错误态、加载态三件套齐备；错误态展示 `requestId` 便于排错。

## 验证方式

页面验收统一用 magpie-browser MCP 在 1440 / 1024 / 390 三档、明暗两种主题下走一遍；不写临时 Playwright 脚本。
