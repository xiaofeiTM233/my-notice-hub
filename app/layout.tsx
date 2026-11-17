// app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import './globals.css'
import { AppProviders } from '@/components/providers/AppProviders'
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/shared/constants'

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

// 在首帧前确定主题，避免暗色模式闪白。
const THEME_SCRIPT = `(function(){try{var key='notice-theme';var mode=localStorage.getItem(key)||'system';var dark=mode==='dark'||(mode==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var theme=dark?'dark':'light';document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;}catch(e){document.documentElement.dataset.theme='light';}})();`

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {/* antd 的 cssinjs 在模块初始化时取随机串，需要流式边界避免预渲染期求值。 */}
        <Suspense fallback={null}>
          <AppProviders>{children}</AppProviders>
        </Suspense>
      </body>
    </html>
  )
}
