// components/site/NoticeDetailView.tsx
'use client'
import {
  ArrowLeftOutlined,
  CopyOutlined,
  DownloadOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import { App, Button, Skeleton, Tag } from 'antd'
import Link from 'next/link'
import { ErrorState } from '@/components/common/ErrorState'
import { MediaImage } from '@/components/common/MediaImage'
import { ArticleToc } from '@/components/site/ArticleToc'
import { ContentRenderer } from '@/components/editor/ContentRenderer'
import { useApiQuery } from '@/hooks/useApiQuery'
import { PRIORITY_LABEL } from '@/lib/shared/constants'
import { formatDate } from '@/lib/shared/format'
import type { NoticeDetailResponse } from '@/lib/shared/types'

export function NoticeDetailView({ noticeId }: { noticeId: string }) {
  const { data, loading, error, refresh } = useApiQuery<NoticeDetailResponse>(
    `/api/notices/${noticeId}`,
  )
  const { message } = App.useApp()
  const editorId = `notice-${noticeId}`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      message.success('链接已复制')
    } catch {
      message.warning('复制失败，请手动复制地址栏链接')
    }
  }

  if (error) {
    return (
      <div className="site-container">
        <ErrorState message={error.message} onRetry={refresh} />
      </div>
    )
  }

  if (loading || !data) {
    return (
      <div className="site-container">
        <div className="detail-article">
          <Skeleton active avatar paragraph={{ rows: 8 }} />
        </div>
      </div>
    )
  }

  return (
    <div className="site-container">
      <div className="breadcrumb-line">
        <Link href="/">
          <ArrowLeftOutlined /> 返回列表
        </Link>
      </div>

      <div className={data.bodyFormat === 'markdown' ? 'detail-layout' : 'detail-layout single'}>
        <article className="detail-article">
          <h1 className="detail-title">{data.title}</h1>

          <div className="detail-meta">
            <Tag variant="filled" color="blue">
              {data.channel}
            </Tag>
            <span>{formatDate(data.timestamp, true)}</span>
            {data.author?.name ? (
              <>
                <span className="meta-dot" aria-hidden />
                <span>{data.author.name}</span>
              </>
            ) : null}
            <span className="meta-dot" aria-hidden />
            <span className="priority">
              <span className={`priority-dot ${data.priority}`} aria-hidden />
              {PRIORITY_LABEL[data.priority]}
            </span>
            <Button type="text" size="small" icon={<CopyOutlined />} onClick={copyLink}>
              复制链接
            </Button>
          </div>

          {data.cover ? (
            <div className="detail-cover">
              <MediaImage mediaId={data.cover} alt={data.title} fill sizes="800px" />
            </div>
          ) : null}

          <ContentRenderer body={data.body} bodyFormat={data.bodyFormat} editorId={editorId} />

          {data.attachments.length > 0 ? (
            <section className="detail-section">
              <h2 className="detail-section-title">附件</h2>
              <div className="attachment-list">
                {data.attachments.map((item) => (
                  <a
                    key={item.id}
                    className="attachment-item"
                    href={`/api/media/${item.id}?download=1`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FileTextOutlined />
                    <span className="attachment-name">{item.name || `附件.${item.format}`}</span>
                    <DownloadOutlined />
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          {data.tags.length > 0 ? (
            <section className="detail-section">
              <h2 className="detail-section-title">标签</h2>
              <div className="detail-tags">
                {data.tags.map((tag) => (
                  <Tag key={tag} variant="filled">
                    #{tag}
                  </Tag>
                ))}
              </div>
            </section>
          ) : null}

          <div className="prev-next">
            {data.prev ? (
              <Link className="prev-next-item" href={`/notices/${data.prev.id}`}>
                <span>上一篇</span>
                <span className="prev-next-title">{data.prev.title}</span>
              </Link>
            ) : null}
            {data.next ? (
              <Link className="prev-next-item next" href={`/notices/${data.next.id}`}>
                <span>下一篇</span>
                <span className="prev-next-title">{data.next.title}</span>
              </Link>
            ) : null}
          </div>
        </article>

        {data.bodyFormat === 'markdown' ? <ArticleToc editorId={editorId} /> : null}
      </div>
    </div>
  )
}
