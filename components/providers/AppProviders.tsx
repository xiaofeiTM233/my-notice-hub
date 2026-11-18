// components/providers/AppProviders.tsx
'use client'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import type { ReactNode } from 'react'
import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { useThemeMode } from '@/hooks/useThemeMode'
import { buildAntdTheme } from '@/lib/client/theme'
import type { ResolvedTheme } from '@/lib/shared/theme'

dayjs.locale('zh-cn')

interface AppProvidersProps {
  initialTheme: ResolvedTheme
  children: ReactNode
}

// 主题要先于 ConfigProvider 生效，antd 才能在首帧拿到正确的算法。
function AntdShell({ children }: { children: ReactNode }) {
  const { isDark } = useThemeMode()

  return (
    <ConfigProvider locale={zhCN} theme={buildAntdTheme(isDark)}>
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  )
}

export function AppProviders({ initialTheme, children }: AppProvidersProps) {
  return (
    <AntdRegistry>
      <ThemeProvider initialTheme={initialTheme}>
        <AntdShell>
          <SessionProvider>{children}</SessionProvider>
        </AntdShell>
      </ThemeProvider>
    </AntdRegistry>
  )
}
