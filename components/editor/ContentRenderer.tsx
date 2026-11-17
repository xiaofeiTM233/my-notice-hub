// components/editor/ContentRenderer.tsx
'use client'
import dynamic from 'next/dynamic'
import 'md-editor-rt/lib/preview.css'
import { useThemeMode } from '@/hooks/useThemeMode'

const MdPreview = dynamic(() => import('md-editor-rt').then((mod) => mod.MdPreview), {
  ssr: false,
})

interface ContentRendererProps {
  body: string
  bodyFormat: 'markdown' | 'html'
  editorId?: string
}

export function ContentRenderer({ body, bodyFormat, editorId = 'notice-preview' }: ContentRendererProps) {
  const { isDark } = useThemeMode()

  if (bodyFormat === 'html') {
    // 服务端已按白名单净化，这里只负责渲染。
    return <div className="rich-content" dangerouslySetInnerHTML={{ __html: body }} />
  }

  return (
    <div className="rich-content md-body">
      <MdPreview
        editorId={editorId}
        value={body}
        language="zh-CN"
        theme={isDark ? 'dark' : 'light'}
        previewTheme="github"
        codeTheme={isDark ? 'atom' : 'github'}
      />
    </div>
  )
}
