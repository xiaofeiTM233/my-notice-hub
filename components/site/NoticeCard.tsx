// components/site/NoticeCard.tsx
import Link from 'next/link'
import { MediaImage } from '@/components/common/MediaImage'
import { PRIORITY_LABEL } from '@/lib/shared/constants'
import { formatRelative } from '@/lib/shared/format'
import type { NoticeSummaryDto } from '@/lib/shared/types'

export function NoticeCard({ notice }: { notice: NoticeSummaryDto }) {
  return (
    <Link href={`/notices/${notice.id}`} className="notice-card">
      <div className="notice-card-cover">
        <MediaImage
          mediaId={notice.cover}
          alt={notice.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px"
        />
      </div>
      <div className="notice-card-body">
        <h3 className="notice-card-title">{notice.title}</h3>
        <p className="notice-card-summary">{notice.summary || '暂无摘要'}</p>
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
