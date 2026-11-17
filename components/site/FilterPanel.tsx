// components/site/FilterPanel.tsx
'use client'
import { ReloadOutlined } from '@ant-design/icons'
import { DatePicker, Segmented } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import {
  MAX_TAGS_PER_NOTICE,
  NOTICE_PRIORITIES,
  PRIORITY_LABEL,
  type NoticePriority,
} from '@/lib/shared/constants'
import type { NoticeQuery, NoticeSort } from '@/lib/shared/notice-query'
import type { ChannelStat, TagStat } from '@/lib/shared/types'

interface FilterPanelProps {
  query: NoticeQuery
  channels: ChannelStat[]
  tags: TagStat[]
  onChange: (patch: Partial<NoticeQuery>) => void
  onReset: () => void
}

function toRange(query: NoticeQuery): [Dayjs | null, Dayjs | null] | null {
  if (!query.from && !query.to) return null
  return [
    query.from ? dayjs(query.from * 1000) : null,
    query.to ? dayjs(query.to * 1000) : null,
  ]
}

export function FilterPanel({ query, channels, tags, onChange, onReset }: FilterPanelProps) {
  const hasFilters =
    query.channel.length > 0 ||
    query.priority.length > 0 ||
    query.tag.length > 0 ||
    Boolean(query.from) ||
    Boolean(query.to)

  const togglePriority = (priority: NoticePriority) => {
    const next = query.priority.includes(priority)
      ? query.priority.filter((item) => item !== priority)
      : [...query.priority, priority]
    onChange({ priority: next })
  }

  const toggleTag = (tag: string) => {
    const next = query.tag.includes(tag)
      ? query.tag.filter((item) => item !== tag)
      : [...query.tag, tag].slice(-MAX_TAGS_PER_NOTICE)
    onChange({ tag: next })
  }

  return (
    <aside className="filter-panel" aria-label="筛选条件">
      <div className="filter-group">
        <span className="filter-label">频道</span>
        <div className="check-list">
          <button
            type="button"
            className={`channel-item${query.channel.length === 0 ? ' active' : ''}`}
            onClick={() => onChange({ channel: [] })}
            aria-pressed={query.channel.length === 0}
          >
            全部
          </button>
          {channels.slice(0, 10).map((item) => {
            const active = query.channel.includes(item.channel)
            return (
              <button
                key={item.channel}
                type="button"
                className={`channel-item${active ? ' active' : ''}`}
                onClick={() => onChange({ channel: active ? [] : [item.channel] })}
                aria-pressed={active}
              >
                <span>{item.channel}</span>
                <span className="channel-count">{item.count}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="filter-group">
        <span className="filter-label">优先级</span>
        <div className="check-list">
          {NOTICE_PRIORITIES.map((priority) => {
            const active = query.priority.includes(priority)
            return (
              <button
                key={priority}
                type="button"
                className={`priority-item${active ? ' active' : ''}`}
                onClick={() => togglePriority(priority)}
                aria-pressed={active}
              >
                <span className={`priority-dot ${priority}`} aria-hidden />
                {PRIORITY_LABEL[priority]}
              </button>
            )
          })}
        </div>
      </div>

      {tags.length > 0 ? (
        <div className="filter-group">
          <span className="filter-label">标签</span>
          <div className="filter-tags">
            {tags.slice(0, 16).map((item) => {
              const active = query.tag.includes(item.tag)
              return (
                <button
                  key={item.tag}
                  type="button"
                  className={`tag-chip${active ? ' active' : ''}`}
                  onClick={() => toggleTag(item.tag)}
                  aria-pressed={active}
                >
                  {item.tag}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="filter-group">
        <span className="filter-label">发布时间</span>
        <div className="filter-date">
          <DatePicker.RangePicker
            value={toRange(query)}
            size="small"
            allowClear
            placeholder={['开始日期', '结束日期']}
            onChange={(values) =>
              onChange({
                from: values?.[0] ? values[0].startOf('day').unix() : undefined,
                to: values?.[1] ? values[1].endOf('day').unix() : undefined,
              })
            }
          />
        </div>
      </div>

      <div className="filter-group">
        <span className="filter-label">排序</span>
        <Segmented
          block
          size="small"
          value={query.sort}
          onChange={(value) => onChange({ sort: value as NoticeSort })}
          options={[
            { value: 'newest', label: '最新优先' },
            { value: 'oldest', label: '最早优先' },
          ]}
        />
      </div>

      <button
        type="button"
        className="filter-reset"
        onClick={onReset}
        disabled={!hasFilters}
      >
        <ReloadOutlined /> 重置筛选
      </button>
    </aside>
  )
}
