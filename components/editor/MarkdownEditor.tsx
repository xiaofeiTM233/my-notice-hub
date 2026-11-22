// components/editor/MarkdownEditor.tsx
'use client'
import 'md-editor-rt/lib/style.css'
import { App } from 'antd'
import { MdEditor, XSSPlugin, config } from 'md-editor-rt'
import { useThemeMode } from '@/hooks/useThemeMode'
import { apiFetch } from '@/lib/client/api'
import type { MediaDto } from '@/lib/shared/types'

// 导入公告的正文是 HTML，编辑器需要开启原生 HTML 解析并走白名单清洗
config({
  markdownItConfig: (md) => {
    md.set({ html: true })
    XSSPlugin(md, {
      xss: (xss) => {
        const whiteList = xss.getDefaultWhiteList()
        delete whiteList.iframe
        for (const tag of Object.keys(whiteList)) {
          whiteList[tag] = [...new Set([...(whiteList[tag] ?? []), 'class'])]
        }
        whiteList.img = [...new Set([...(whiteList.img ?? []), 'loading'])]
        return { whiteList, stripIgnoreTag: true, stripIgnoreTagBody: ['script', 'style'] }
      },
    })
  },
})

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  height?: number
}

export function MarkdownEditor({ value, onChange, height = 540 }: MarkdownEditorProps) {
  const { isDark } = useThemeMode()
  const { message } = App.useApp()

  const handleUpload = async (
    files: File[],
    callback: (urls: string[] | { url: string; alt: string; title: string }[]) => void,
  ) => {
    const urls: string[] = []

    for (const file of files) {
      const form = new FormData()
      form.append('file', file)
      try {
        const media = await apiFetch<MediaDto>('/api/admin/media', { method: 'POST', body: form })
        urls.push(`/api/media/${media.id}`)
      } catch (error) {
        message.error(error instanceof Error ? error.message : '图片上传失败')
      }
    }

    callback(urls)
  }

  return (
    <MdEditor
      value={value}
      onChange={onChange}
      theme={isDark ? 'dark' : 'light'}
      language="zh-CN"
      style={{ height }}
      previewTheme="github"
      codeTheme={isDark ? 'atom' : 'github'}
      onUploadImg={handleUpload}
      noUploadImg={false}
      placeholder="支持 Markdown；插入图片会上传到当前媒体存储。"
    />
  )
}
