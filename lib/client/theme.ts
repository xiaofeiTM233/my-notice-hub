// lib/client/theme.ts
'use client'
import { theme, type ThemeConfig } from 'antd'

export const FONT_STACK =
  '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'

// 组件配色与圆角都交给 antd 默认值，这里只统一中文字体与控件高度。
export function buildAntdTheme(isDark: boolean): ThemeConfig {
  return {
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      fontFamily: FONT_STACK,
      fontSize: 14,
      controlHeight: 36,
    },
    components: {
      Layout: {
        headerHeight: 56,
      },
      Menu: {
        itemHeight: 38,
      },
    },
  }
}
