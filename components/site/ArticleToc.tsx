// components/site/ArticleToc.tsx
'use client'
import dynamic from 'next/dynamic'
import { useThemeMode } from '@/hooks/useThemeMode'

const MdCatalog = dynamic(() => import('md-editor-rt').then((mod) => mod.MdCatalog), {
  ssr: false,
})

export function ArticleToc({ editorId }: { editorId: string }) {
  const { isDark } = useThemeMode()

  return (
    <aside className="detail-toc">
      <div className="detail-toc-title">目录</div>
      <MdCatalog editorId={editorId} theme={isDark ? 'dark' : 'light'} />
    </aside>
  )
}
