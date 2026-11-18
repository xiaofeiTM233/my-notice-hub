// lib/shared/theme.ts
import type { ThemeMode } from '@/lib/shared/constants'

// 服务端渲染与首帧脚本必须读同一份已解析主题，否则 antd 先输出亮色 token 再被客户端覆盖，形成白闪。
export const THEME_COOKIE = 'notice-theme'
export const THEME_STORAGE_KEY = 'notice-theme'
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export type ResolvedTheme = 'light' | 'dark'

export function normalizeResolvedTheme(value: string | undefined | null): ResolvedTheme | null {
  return value === 'light' || value === 'dark' ? value : null
}

export function resolveTheme(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  return mode === 'dark' || (mode === 'system' && prefersDark) ? 'dark' : 'light'
}

export function buildThemeCookie(theme: ResolvedTheme): string {
  return `${THEME_COOKIE}=${theme}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`
}
