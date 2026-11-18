// hooks/useThemeMode.ts
'use client'
import { useContext } from 'react'
import { ThemeContext } from '@/lib/client/theme-context'
import type { ThemeMode } from '@/lib/shared/constants'

// 主题状态由 ThemeProvider 统一维护，读取方直接取上下文，避免各自维护一份系统偏好副本。
export function useThemeMode(): {
  mode: ThemeMode
  isDark: boolean
  setMode: (mode: ThemeMode) => void
} {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useThemeMode 必须在 ThemeProvider 内使用')
  }
  return context
}
