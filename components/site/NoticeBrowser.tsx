// components/site/NoticeBrowser.tsx
'use client'
import { SearchOutlined } from '@ant-design/icons'
import { Button, Input, Skeleton } from 'antd'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { FilterPanel } from '@/components/site/FilterPanel'
import { NoticeCard } from '@/components/site/NoticeCard'
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
  const { query, apply, reset } = useNoticeFilters()
  const view = useUIStore((state) => state.noticeView)
  const setView = useUIStore((state) => state.setNoticeView)

  const { data: channels } = useApiQuery<ChannelStat[]>('/api/channels')
  const { data: tags } = useApiQuery<TagStat[]>('/api/tags', { limit: 24 })
  const { data, loading, error, refresh } = useApiQuery<Paginated<NoticeSummaryDto>>(
    '/api/notices',
    toRequestParams(query),
  )

  const items = data?.items ?? []

  return (
    <div className="site-container browse-layout">
      <FilterPanel
        query={query}
        channels={channels ?? []}
        tags={tags ?? []}
        onChange={apply}
        onReset={reset}
      />

      <section>
        <div className="browse-toolbar">
          <div>
            <div className="browse-title">最新公告</div>
            <div className="result-count">共 {data?.total ?? 0} 条</div>
          </div>
          <div className="row">
            <Input.Search
              key={query.q}
              className="browse-search"
              allowClear
              defaultValue={query.q}
              placeholder="搜索标题或摘要"
              enterButton={<SearchOutlined />}
              onSearch={(value) => apply({ q: value.trim() })}
              aria-label="搜索公告"
            />
            <ViewSwitch value={view} onChange={setView} />
          </div>
        </div>

        {error ? (
          <ErrorState message={error.message} onRetry={refresh} />
        ) : loading ? (
          <div className="notice-grid">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="notice-card skeleton-card">
                <div className="skeleton-block skeleton-cover" />
                <div className="notice-card-body">
                  <Skeleton active title paragraph={{ rows: 3 }} />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="没有匹配的公告"
            description="换个关键词，或清空筛选条件再看看"
            action={<Button onClick={reset}>重置筛选</Button>}
          />
        ) : view === 'list' ? (
          <div className="notice-rows">
            {items.map((notice) => (
              <NoticeListRow key={notice.id} notice={notice} />
            ))}
          </div>
        ) : (
          <div className={view === 'masonry' ? 'masonry' : 'notice-grid'}>
            {items.map((notice) => (
              <NoticeCard key={notice.id} notice={notice} />
            ))}
          </div>
        )}

        <PaginationBar
          page={data?.page ?? query.page}
          pageSize={data?.pageSize ?? query.pageSize}
          total={data?.total ?? 0}
          onChange={(page, pageSize) => apply({ page, pageSize })}
        />
      </section>
    </div>
  )
}
