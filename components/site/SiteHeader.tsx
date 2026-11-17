// components/site/SiteHeader.tsx
'use client'
import { SettingOutlined } from '@ant-design/icons'
import Link from 'next/link'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { SITE_NAME } from '@/lib/shared/constants'

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-container site-header-inner">
        <Link href="/" className="site-brand" aria-label={`${SITE_NAME} 首页`}>
          <span className="brand-mark" aria-hidden>
            {SITE_NAME.slice(0, 1)}
          </span>
          <span className="brand-text">
            <span className="brand-name">{SITE_NAME}</span>
            <span className="brand-sub">Notice Hub</span>
          </span>
        </Link>

        <div className="site-header-actions">
          <ThemeToggle />
          <Link href="/admin/notices" className="icon-link" aria-label="管理后台" title="管理后台">
            <SettingOutlined />
          </Link>
        </div>
      </div>
    </header>
  )
}
