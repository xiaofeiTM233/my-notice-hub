// components/site/NoticeListRow.tsx
import Link from 'next/link'
import { MediaImage } from '@/components/common/MediaImage'
import { PRIORITY_COLOR, PRIORITY_LABEL } from '@/lib/shared/constants'
import { formatRelative } from '@/lib/shared/format'
import type { NoticeSummaryDto } from '@/lib/shared/types'

export function NoticeListRow({ notice }: { notice: NoticeSummaryDto }) {
  return (
    <Link href={`/notices/${notice.id}`} className="notice-row">
      <div className="notice-row-thumb">
        <MediaImage mediaId={notice.cover} alt={notice.title} fill sizes="128px" />
      </div>
      <div className="notice-row-main">
        <div className="notice-row-title">{notice.title}</div>
        <div className="notice-row-summary">{notice.summary || '暂无摘要'}</div>
        <div className="notice-card-meta">
          <span>{notice.channel}</span>
          <span className="meta-dot">{formatRelative(notice.timestamp)}</span>
          <span className="priority">
            <span className="priority-dot" style={{ background: PRIORITY_COLOR[notice.priority] }} />
            {PRIORITY_LABEL[notice.priority]}
          </span>
          {notice.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="meta-dot">
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </Link>
  )
}
