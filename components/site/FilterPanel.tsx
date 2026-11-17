// components/site/FilterPanel.tsx
'use client'
import { ReloadOutlined } from '@ant-design/icons'
import { Button, Checkbox, DatePicker, Radio, Segmented, Tag } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import {
  NOTICE_PRIORITIES,
  PRIORITY_LABEL,
  type NoticePriority,
} from '@/lib/shared/constants'
import type { NoticeSort, NoticeQuery } from '@/lib/shared/notice-query'
import type { ChannelStat, TagStat } from '@/lib/shared/types'

interface FilterPanelProps {
  query: NoticeQuery
  channels: ChannelStat[]
  tags: TagStat[]
  onChange: (patch: Partial<NoticeQuery>) => void
  onReset: () => void
}

export function FilterPanel({ query, channels, tags, onChange, onReset }: FilterPanelProps) {
  const range: [Dayjs | null, Dayjs | null] | null =
    query.from || query.to
      ? [query.from ? dayjs(query.from * 1000) : null, query.to ? dayjs(query.to * 1000) : null]
      : null

  return (
    <aside className="filter-panel">
      <div className="filter-group">
        <span className="filter-label">频道</span>
        <Radio.Group
          value={query.channel[0] ?? ''}
          onChange={(event) =>
            onChange({ channel: event.target.value ? [event.target.value as string] : [] })
          }
        >
          <div className="check-list">
            <Radio value="">全部</Radio>
            {channels.slice(0, 10).map((item) => (
              <Radio key={item.channel} value={item.channel}>
                {item.channel} <span className="muted">{item.count}</span>
              </Radio>
            ))}
          </div>
        </Radio.Group>
      </div>

      <div className="filter-group">
        <span className="filter-label">优先级</span>
        <Checkbox.Group
          value={query.priority}
          onChange={(values) => onChange({ priority: values as NoticePriority[] })}
        >
          <div className="check-list">
            {NOTICE_PRIORITIES.map((priority) => (
              <Checkbox key={priority} value={priority}>
                {PRIORITY_LABEL[priority]}
              </Checkbox>
            ))}
          </div>
        </Checkbox.Group>
      </div>

      {tags.length > 0 ? (
        <div className="filter-group">
          <span className="filter-label">标签</span>
          <div className="filter-tags">
            {tags.slice(0, 12).map((item) => (
              <Tag.CheckableTag
                key={item.tag}
                checked={query.tag.includes(item.tag)}
                onChange={(checked) =>
                  onChange({
                    tag: checked
                      ? [...query.tag, item.tag]
                      : query.tag.filter((tag) => tag !== item.tag),
                  })
                }
              >
                {item.tag}
              </Tag.CheckableTag>
            ))}
          </div>
        </div>
      ) : null}

      <div className="filter-group">
        <span className="filter-label">发布时间</span>
        <DatePicker.RangePicker
          value={range}
          allowEmpty={[true, true]}
          onChange={(dates) =>
            onChange({
              from: dates?.[0] ? dates[0].startOf('day').unix() : undefined,
              to: dates?.[1] ? dates[1].endOf('day').unix() : undefined,
            })
          }
        />
      </div>

      <div className="filter-group">
        <span className="filter-label">排序</span>
        <Segmented
          block
          value={query.sort}
          onChange={(value) => onChange({ sort: value as NoticeSort })}
          options={[
            { value: 'newest', label: '最新优先' },
            { value: 'oldest', label: '最早优先' },
          ]}
        />
      </div>

      <Button icon={<ReloadOutlined />} onClick={onReset}>
        重置筛选
      </Button>
    </aside>
  )
}
