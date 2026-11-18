// lib/client/theme-context.ts
'use client'
import { createContext } from 'react'
import type { ThemeMode } from '@/lib/shared/constants'

export interface ThemeContextValue {
  mode: ThemeMode
  isDark: boolean
  setMode: (mode: ThemeMode) => void
}

// 首帧配色来自服务端渲染结论，客户端只负责后续切换，避免水合前后出现两套主题。
export const ThemeContext = createContext<ThemeContextValue | null>(null)