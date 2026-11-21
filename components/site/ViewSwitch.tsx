// components/site/ViewSwitch.tsx
'use client'
import { AppstoreOutlined, BarsOutlined, FieldTimeOutlined } from '@ant-design/icons'
import { Segmented } from 'antd'
import { LIST_VIEW_LABEL, type ListView } from '@/lib/shared/constants'

export function ViewSwitch({
  value,
  onChange,
}: {
  value: ListView
  onChange: (value: ListView) => void
}) {
  return (
    <Segmented
      aria-label="切换列表视图"
      size="small"
      value={value}
      onChange={(next) => onChange(next as ListView)}
      options={[
        { value: 'card', label: LIST_VIEW_LABEL.card, icon: <AppstoreOutlined /> },
        { value: 'list', label: LIST_VIEW_LABEL.list, icon: <BarsOutlined /> },
        { value: 'feed', label: LIST_VIEW_LABEL.feed, icon: <FieldTimeOutlined /> },
      ]}
    />
  )
}
