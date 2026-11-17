// lib/client/theme.ts
'use client'
import { theme, type ThemeConfig } from 'antd'

export const FONT_STACK =
  'Inter, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif'

export function buildAntdTheme(isDark: boolean): ThemeConfig {
  return {
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: '#2F5BEA',
      colorInfo: '#2F5BEA',
      borderRadius: 10,
      borderRadiusLG: 14,
      fontFamily: FONT_STACK,
      fontSize: 14,
      colorBgLayout: isDark ? '#0B0F17' : '#F4F6FB',
      colorBgContainer: isDark ? '#131A26' : '#FFFFFF',
      colorText: isDark ? '#E8ECF3' : '#0F172A',
      colorTextSecondary: isDark ? '#93A0B4' : '#5B6577',
      colorBorder: isDark ? '#2A3444' : '#E6EAF2',
      colorBorderSecondary: isDark ? '#232C3B' : '#E6EAF2',
    },
    components: {
      Layout: {
        bodyBg: 'transparent',
        headerBg: 'transparent',
        siderBg: 'transparent',
        headerHeight: 56,
      },
      Menu: {
        itemBg: 'transparent',
        subMenuItemBg: 'transparent',
        itemHeight: 40,
        itemBorderRadius: 8,
        itemMarginInline: 8,
      },
      Card: {
        borderRadiusLG: 14,
      },
      Table: {
        headerBg: isDark ? '#182131' : '#F8FAFF',
        headerSplitColor: 'transparent',
      },
      Segmented: {
        itemSelectedBg: isDark ? '#1E2A3C' : '#FFFFFF',
      },
    },
  }
}
