// app/(site)/layout.tsx
import { Suspense } from 'react'
import type { ReactNode } from 'react'
import { SiteHeader } from '@/components/site/SiteHeader'

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site-shell">
      {/* 顶栏读取网址参数，静态外壳下需要独立的 Suspense 边界。 */}
      <Suspense fallback={<div className="site-header" />}>
        <SiteHeader />
      </Suspense>
      <main className="site-main">{children}</main>
    </div>
  )
}
