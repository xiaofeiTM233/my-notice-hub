// lib/client/stores/ui.ts
'use client'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  DEFAULT_PAGE_SIZE,
  type ListView,
  type ThemeMode,
} from '@/lib/shared/constants'

interface UIState {
  themeMode: ThemeMode
  noticeView: ListView
  pageSize: number
  siderCollapsed: boolean
  setThemeMode: (mode: ThemeMode) => void
  setNoticeView: (view: ListView) => void
  setPageSize: (size: number) => void
  setSiderCollapsed: (collapsed: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      themeMode: 'system',
      noticeView: 'card',
      pageSize: DEFAULT_PAGE_SIZE,
      siderCollapsed: false,
      setThemeMode: (themeMode) => set({ themeMode }),
      setNoticeView: (noticeView) => set({ noticeView }),
      setPageSize: (pageSize) => set({ pageSize }),
      setSiderCollapsed: (siderCollapsed) => set({ siderCollapsed }),
    }),
    {
      name: 'notice-hub-ui',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
)
