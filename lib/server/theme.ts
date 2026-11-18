// lib/server/theme.ts
import 'server-only'
import { cookies } from 'next/headers'
import {
  normalizeResolvedTheme,
  THEME_COOKIE,
  type ResolvedTheme,
} from '@/lib/shared/theme'

// 服务端渲染前先取已解析主题，让 antd 首帧就输出正确配色，避免暗色站点先渲染成亮色再翻转。
export async function readResolvedTheme(): Promise<ResolvedTheme> {
  const cookieStore = await cookies()
  return normalizeResolvedTheme(cookieStore.get(THEME_COOKIE)?.value) ?? 'light'
}
