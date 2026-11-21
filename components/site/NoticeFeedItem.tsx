// components/site/NoticeFeedItem.tsx
import Link from 'next/link'
import { MediaImage } from '@/components/common/MediaImage'
import { PRIORITY_LABEL } from '@/lib/shared/constants'
import { formatRelative } from '@/lib/shared/format'
import type { NoticeSummaryDto } from '@/lib/shared/types'

const FEED_TAG_LIMIT = 3

export function NoticeFeedItem({ notice }: { notice: NoticeSummaryDto }) {
  const authorName = notice.author?.name?.trim() || notice.channel
  const avatar = notice.author?.avatar ?? null
  const tags = notice.tags.slice(0, FEED_TAG_LIMIT)

  return (
    <Link href={`/notices/${notice.id}`} className="feed-item">
      <div className="feed-avatar">
        {avatar ? (
          <MediaImage mediaId={avatar} alt={authorName} fill sizes="46px" />
        ) : (
          <span className="feed-avatar-text" aria-hidden>
            {authorName.slice(0, 1)}
          </span>
        )}
      </div>

      <div className="feed-main">
        <div className="feed-head">
          <span className="feed-author">{authorName}</span>
          <span className="feed-channel">{notice.channel}</span>
          <span className="feed-dot" aria-hidden />
          <span className="feed-time">{formatRelative(notice.timestamp)}</span>
        </div>

        <h3 className="feed-title">{notice.title}</h3>
        {notice.summary ? <p className="feed-summary">{notice.summary}</p> : null}

        {notice.cover ? (
          <div className="feed-media">
            <MediaImage
              mediaId={notice.cover}
              alt={notice.title}
              fill
              sizes="(max-width: 900px) 100vw, 560px"
            />
          </div>
        ) : null}

        <div className="feed-foot">
          <span className="feed-foot-item">
            <span className={`priority-dot ${notice.priority}`} aria-hidden />
            {PRIORITY_LABEL[notice.priority]}
          </span>
          {notice.entityCount > 0 ? (
            <span className="feed-foot-item">{notice.entityCount} 个附件</span>
          ) : null}
          {tags.map((tag) => (
            <span key={tag} className="feed-foot-item feed-tag">
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </Link>
  )
}
