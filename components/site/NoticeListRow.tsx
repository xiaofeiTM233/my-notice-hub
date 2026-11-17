// components/site/NoticeListRow.tsx
import Link from 'next/link'
import { MediaImage } from '@/components/common/MediaImage'
import { PRIORITY_LABEL } from '@/lib/shared/constants'
import { formatRelative } from '@/lib/shared/format'
import type { NoticeSummaryDto } from '@/lib/shared/types'

export function NoticeListRow({ notice }: { notice: NoticeSummaryDto }) {
  return (
    <Link href={`/notices/${notice.id}`} className="notice-row">
      <div className="notice-row-thumb">
        <MediaImage mediaId={notice.cover} alt={notice.title} fill sizes="108px" />
      </div>
      <div className="notice-row-main">
        <h3 className="notice-row-title">{notice.title}</h3>
        <p className="notice-row-summary">{notice.summary || '暂无摘要'}</p>
        <div className="notice-card-meta">
          <span className={`priority-dot ${notice.priority}`} aria-hidden />
          <span>{PRIORITY_LABEL[notice.priority]}</span>
          <span className="meta-dot" aria-hidden />
          <span>{notice.channel}</span>
          <span className="meta-dot" aria-hidden />
          <span>{formatRelative(notice.timestamp)}</span>
          {notice.entityCount > 0 ? (
            <>
              <span className="meta-dot" aria-hidden />
              <span>{notice.entityCount} 个附件</span>
            </>
          ) : null}
        </div>
      </div>
    </Link>
  )
}
