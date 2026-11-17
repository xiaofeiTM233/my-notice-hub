// components/common/ThemeToggle.tsx
'use client'
import { DesktopOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons'
import { Segmented } from 'antd'
import type { ThemeMode } from '@/lib/shared/constants'
import { useThemeMode } from '@/hooks/useThemeMode'

export function ThemeToggle() {
  const { mode, setMode } = useThemeMode()

  return (
    <Segmented
      className="theme-toggle"
      aria-label="切换主题"
      size="small"
      value={mode}
      onChange={(value) => setMode(value as ThemeMode)}
      options={[
        { value: 'light', icon: <SunOutlined />, title: '亮色' },
        { value: 'system', icon: <DesktopOutlined />, title: '跟随系统' },
        { value: 'dark', icon: <MoonOutlined />, title: '暗色' },
      ]}
    />
  )
}
