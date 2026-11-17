// components/admin/NoticeFilterBar.tsx
'use client'
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, DatePicker, Input, Select } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import {
  NOTICE_PRIORITIES,
  PRIORITY_LABEL,
  type NoticePriority,
} from '@/lib/shared/constants'
import type { NoticeQuery, NoticeSort } from '@/lib/shared/notice-query'
import type { ChannelStat, TagStat } from '@/lib/shared/types'

interface NoticeFilterBarProps {
  query: NoticeQuery
  channels: ChannelStat[]
  tags: TagStat[]
  onChange: (patch: Partial<NoticeQuery>) => void
  onReset: () => void
}

export function NoticeFilterBar({ query, channels, tags, onChange, onReset }: NoticeFilterBarProps) {
  const range: [Dayjs | null, Dayjs | null] | null =
    query.from || query.to
      ? [query.from ? dayjs(query.from * 1000) : null, query.to ? dayjs(query.to * 1000) : null]
      : null

  return (
    <div className="filter-bar">
      <Input.Search
        key={query.q}
        allowClear
        defaultValue={query.q}
        placeholder="标题或摘要关键词"
        enterButton={<SearchOutlined />}
        style={{ width: 220 }}
        onSearch={(value) => onChange({ q: value.trim() })}
      />

      <Select
        mode="multiple"
        allowClear
        placeholder="频道"
        style={{ minWidth: 160 }}
        value={query.channel}
        onChange={(values: string[]) => onChange({ channel: values })}
        options={channels.map((item) => ({ value: item.channel, label: `${item.channel} (${item.count})` }))}
      />

      <Select
        mode="multiple"
        allowClear
        placeholder="优先级"
        style={{ minWidth: 140 }}
        value={query.priority}
        onChange={(values: NoticePriority[]) => onChange({ priority: values })}
        options={NOTICE_PRIORITIES.map((item) => ({ value: item, label: PRIORITY_LABEL[item] }))}
      />

      <Select
        mode="multiple"
        allowClear
        placeholder="标签"
        style={{ minWidth: 160 }}
        value={query.tag}
        onChange={(values: string[]) => onChange({ tag: values })}
        options={tags.map((item) => ({ value: item.tag, label: `${item.tag} (${item.count})` }))}
      />

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

      <Select<NoticeSort>
        value={query.sort}
        style={{ minWidth: 120 }}
        onChange={(value) => onChange({ sort: value })}
        options={[
          { value: 'newest', label: '最新优先' },
          { value: 'oldest', label: '最早优先' },
        ]}
      />

      <Button icon={<ReloadOutlined />} onClick={onReset}>
        重置
      </Button>
    </div>
  )
}
