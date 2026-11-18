// app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import './globals.css'
import { AppProviders } from '@/components/providers/AppProviders'
import { readResolvedTheme } from '@/lib/server/theme'
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/shared/constants'
import { THEME_COOKIE_MAX_AGE } from '@/lib/shared/theme'

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F6F7F9' },
    { media: '(prefers-color-scheme: dark)', color: '#0A0C11' },
  ],
}

// 主题来自请求 cookie，属运行时数据；允许布局阻塞渲染，换取首帧配色与 antd 一致。
export const instant = false

// 首帧配色由服务端按 cookie 决定。脚本负责：回写 cookie；首次访问等 cookie 缺失的情况下，
// 先按本地偏好校正底色并暂时收起内容，等 antd 用同一套主题重算完再显示，避免露出亮色控件。
const THEME_SYNC_SCRIPT = `(function(){try{var root=document.documentElement;var server=root.getAttribute('data-theme')||'light';var mode='';try{var raw=localStorage.getItem('notice-hub-ui');if(raw){var state=JSON.parse(raw).state;if(state&&state.themeMode)mode=state.themeMode;}}catch(e){}var dark=mode==='dark'||(mode!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var theme=dark?'dark':'light';document.cookie='notice-theme='+theme+'; path=/; max-age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax';if(theme!==server){root.setAttribute('data-theme',theme);root.style.colorScheme=theme;root.classList.add('theme-pending');setTimeout(function(){root.classList.remove('theme-pending');},1500);}}catch(e){}})();`

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  // 先解析主题再渲染，antd 首帧输出的 token 才能与页面底色同属一套。
  const theme = await readResolvedTheme()

  return (
    <html
      lang="zh-CN"
      data-theme={theme}
      style={{ colorScheme: theme }}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SYNC_SCRIPT }} />
      </head>
      <body>
        {/* antd 的 cssinjs 在模块初始化时取随机串，需要流式边界避免预渲染期求值。 */}
        <Suspense fallback={null}>
          <AppProviders initialTheme={theme}>{children}</AppProviders>
        </Suspense>
      </body>
    </html>
  )
}