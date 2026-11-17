// hooks/useThemeMode.ts
'use client'
import { useEffect, useState } from 'react'
import { useUIStore } from '@/lib/client/stores/ui'
import type { ThemeMode } from '@/lib/shared/constants'

export function useThemeMode(): {
  mode: ThemeMode
  isDark: boolean
  setMode: (mode: ThemeMode) => void
} {
  const mode = useUIStore((state) => state.themeMode)
  const setMode = useUIStore((state) => state.setThemeMode)
  // 初值固定为 false 以与服务端渲染一致；真实系统偏好由下面的 effect 同步。
  const [systemDark, setSystemDark] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [])

  const isDark = mode === 'dark' || (mode === 'system' && systemDark)

  useEffect(() => {
    const theme = isDark ? 'dark' : 'light'
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    window.localStorage.setItem('notice-theme', mode)
  }, [isDark, mode])

  return { mode, isDark, setMode }
}
