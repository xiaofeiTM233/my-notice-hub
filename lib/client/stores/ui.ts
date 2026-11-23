// lib/client/stores/ui.ts
'use client'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  DEFAULT_PAGE_SIZE,
  type ListView,
  type MediaView,
  type ThemeMode,
} from '@/lib/shared/constants'

interface UIState {
  themeMode: ThemeMode
  noticeView: ListView
  mediaView: MediaView
  pageSize: number
  siderCollapsed: boolean
  setThemeMode: (mode: ThemeMode) => void
  setNoticeView: (view: ListView) => void
  setMediaView: (view: MediaView) => void
  setPageSize: (size: number) => void
  setSiderCollapsed: (collapsed: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      themeMode: 'system',
      noticeView: 'card',
      mediaView: 'grid',
      pageSize: DEFAULT_PAGE_SIZE,
      siderCollapsed: false,
      setThemeMode: (themeMode) => set({ themeMode }),
      setNoticeView: (noticeView) => set({ noticeView }),
      setMediaView: (mediaView) => set({ mediaView }),
      setPageSize: (pageSize) => set({ pageSize }),
      setSiderCollapsed: (siderCollapsed) => set({ siderCollapsed }),
    }),
    {
      name: 'notice-hub-ui',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      // 瀑布流视图已下线，旧持久化值回落到卡片视图，避免切换器空白
      migrate: (persistedState) => {
        const state = persistedState as Partial<UIState>
        if ((state.noticeView as string) === 'masonry') {
          state.noticeView = 'card'
        }
        return state as UIState
      },
    },
  ),
)
