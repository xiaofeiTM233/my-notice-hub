// components/providers/AppProviders.tsx
'use client'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import type { ReactNode } from 'react'
import { SessionProvider } from 'next-auth/react'
import { useThemeMode } from '@/hooks/useThemeMode'
import { buildAntdTheme } from '@/lib/client/theme'

dayjs.locale('zh-cn')

export function AppProviders({ children }: { children: ReactNode }) {
  const { isDark } = useThemeMode()

  return (
    <AntdRegistry>
      <ConfigProvider locale={zhCN} theme={buildAntdTheme(isDark)}>
        <AntdApp>
          <SessionProvider>{children}</SessionProvider>
        </AntdApp>
      </ConfigProvider>
    </AntdRegistry>
  )
}
