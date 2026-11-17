// components/site/NoticeCard.tsx
import Link from 'next/link'
import { MediaImage } from '@/components/common/MediaImage'
import { PRIORITY_COLOR, PRIORITY_LABEL } from '@/lib/shared/constants'
import { formatRelative } from '@/lib/shared/format'
import type { NoticeSummaryDto } from '@/lib/shared/types'

export function NoticeCard({ notice }: { notice: NoticeSummaryDto }) {
  return (
    <Link href={`/notices/${notice.id}`} className="notice-card">
      <div className="notice-card-cover">
        <MediaImage mediaId={notice.cover} alt={notice.title} fill sizes="(max-width: 768px) 100vw, 420px" />
      </div>
      <div className="notice-card-body">
        <div className="notice-card-title">{notice.title}</div>
        <div className="notice-card-summary">{notice.summary || '暂无摘要'}</div>
        <div className="notice-card-meta">
          <span>{notice.channel}</span>
          <span className="meta-dot">{formatRelative(notice.timestamp)}</span>
          <span className="priority">
            <span className="priority-dot" style={{ background: PRIORITY_COLOR[notice.priority] }} />
            {PRIORITY_LABEL[notice.priority]}
          </span>
          {notice.entityCount > 0 ? <span className="meta-dot">{notice.entityCount} 个附件</span> : null}
        </div>
      </div>
    </Link>
  )
}
