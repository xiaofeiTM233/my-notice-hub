// lib/client/theme.ts
'use client'
import { theme, type ThemeConfig } from 'antd'

export const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif'

// 圆角、字重与控件高度统一走 antd 刻度，避免自定义组件与 antd 组件观感分裂。
export function buildAntdTheme(isDark: boolean): ThemeConfig {
  return {
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      fontFamily: FONT_STACK,
      fontSize: 14,
      fontWeightStrong: 600,
      controlHeight: 32,
      borderRadius: 6,
      borderRadiusLG: 8,
      borderRadiusSM: 4,
    },
    components: {
      Layout: {
        headerHeight: 64,
      },
      Menu: {
        itemHeight: 40,
      },
    },
  }
}
