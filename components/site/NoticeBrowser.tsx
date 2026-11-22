// components/site/NoticeBrowser.tsx
'use client'
import { SearchOutlined } from '@ant-design/icons'
import { Button, Input } from 'antd'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { FilterPanel } from '@/components/site/FilterPanel'
import { NoticeCard } from '@/components/site/NoticeCard'
import { NoticeFeedItem } from '@/components/site/NoticeFeedItem'
import { NoticeListRow } from '@/components/site/NoticeListRow'
import { PaginationBar } from '@/components/site/PaginationBar'
import { ViewSwitch } from '@/components/site/ViewSwitch'
import { useApiQuery } from '@/hooks/useApiQuery'
import { useNoticeFilters } from '@/hooks/useNoticeFilters'
import { useUIStore } from '@/lib/client/stores/ui'
import { toRequestParams } from '@/lib/shared/notice-query'
import type { Paginated } from '@/lib/shared/contracts/common'
import type { ChannelStat, NoticeSummaryDto, TagStat } from '@/lib/shared/types'

export function NoticeBrowser() {
  const { query, apply, reset, filtered } = useNoticeFilters()
  const view = useUIStore((state) => state.noticeView)
  const setView = useUIStore((state) => state.setNoticeView)

  const { data: channels } = useApiQuery<ChannelStat[]>('/api/channels')
  const { data: tags } = useApiQuery<TagStat[]>('/api/tags', { limit: 24 })
  const { data, loading, error, refresh } = useApiQuery<Paginated<NoticeSummaryDto>>(
    '/api/notices',
    toRequestParams(query),
  )

  const items = data?.items ?? []
  const total = data?.total ?? 0

  const renderItems = () => {
    if (view === 'list') {
      return (
        <div className="notice-rows">
          {items.map((notice) => (
            <NoticeListRow key={notice.id} notice={notice} />
          ))}
        </div>
      )
    }

    if (view === 'feed') {
      return (
        <div className="notice-feed">
          {items.map((notice) => (
            <NoticeFeedItem key={notice.id} notice={notice} />
          ))}
        </div>
      )
    }

    return (
      <div className="notice-grid">
        {items.map((notice) => (
          <NoticeCard key={notice.id} notice={notice} />
        ))}
      </div>
    )
  }

  return (
    <div className="site-container">
      <div className="browse-head">
        <div>
          <h1 className="browse-title">全部公告</h1>
          <p className="browse-desc">
            共 <strong>{total}</strong> 条 · 按频道、优先级与时间快速定位
          </p>
        </div>
        <div className="browse-toolbar">
          <Input.Search
            key={query.q}
            className="browse-search"
            placeholder="搜索标题或摘要"
            allowClear
            defaultValue={query.q}
            prefix={<SearchOutlined />}
            onSearch={(value) => apply({ q: value.trim() })}
          />
          <ViewSwitch value={view} onChange={setView} />
        </div>
      </div>

      <div className="browse-layout">
        <FilterPanel
          query={query}
          channels={channels ?? []}
          tags={tags ?? []}
          onChange={apply}
          onReset={reset}
        />

        <section aria-live="polite">
          {error ? <ErrorState message={error.message} onRetry={refresh} /> : null}

          {!error && loading ? (
            view === 'feed' ? (
              <div className="notice-feed">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="skeleton-feed skeleton-block" />
                ))}
              </div>
            ) : (
              <div className="notice-grid">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="skeleton-card skeleton-block" />
                ))}
              </div>
            )
          ) : null}

          {!error && !loading && items.length === 0 ? (
            <EmptyState
              title="没有匹配的公告"
              description={filtered ? '换个关键词，或清空筛选条件再试。' : '稍后再来看看。'}
              action={
                filtered ? (
                  <Button size="small" onClick={reset}>
                    清空筛选
                  </Button>
                ) : undefined
              }
            />
          ) : null}

          {!error && !loading && items.length > 0 ? renderItems() : null}

          {!error && !loading ? (
            <PaginationBar
              page={query.page}
              pageSize={query.pageSize}
              total={total}
              onChange={(page) => {
                apply({ page })
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            />
          ) : null}
        </section>
      </div>
    </div>
  )
}
