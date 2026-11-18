// components/providers/ThemeProvider.tsx
'use client'
import { useCallback, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { useUIStore } from '@/lib/client/stores/ui'
import { ThemeContext } from '@/lib/client/theme-context'
import { buildThemeCookie, resolveTheme, type ResolvedTheme } from '@/lib/shared/theme'

interface ThemeProviderProps {
  initialTheme: ResolvedTheme
  children: ReactNode
}

const DARK_QUERY = '(prefers-color-scheme: dark)'

// 服务端已定下首帧主题，客户端只在挂载后跟随用户偏好与系统设置变化。
export function ThemeProvider({ initialTheme, children }: ThemeProviderProps) {
  const mode = useUIStore((state) => state.themeMode)
  const setMode = useUIStore((state) => state.setThemeMode)

  const subscribe = useCallback((onChange: () => void) => {
    const media = window.matchMedia(DARK_QUERY)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  // 服务端快照取服务端结论，水合阶段不会跳变；挂载后再切到真实的系统偏好。
  const systemDark = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DARK_QUERY).matches,
    () => initialTheme === 'dark',
  )

  const theme = resolveTheme(mode, systemDark)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.style.colorScheme = theme
    // 本轮已挂载完毕，首帧那套临时遮挡可以撑开了。
    root.classList.remove('theme-pending')
    // 回写 cookie，下次服务端渲染就能直接输出同一套配色。
    document.cookie = buildThemeCookie(theme)
  }, [theme])

  const value = useMemo(
    () => ({ mode, isDark: theme === 'dark', setMode }),
    [mode, setMode, theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}