// components/site/ViewSwitch.tsx
'use client'
import { AppstoreOutlined, BarsOutlined, PicCenterOutlined } from '@ant-design/icons'
import { Segmented } from 'antd'
import type { ListView } from '@/lib/shared/constants'

const LABEL: Record<ListView, string> = {
  card: '卡片',
  masonry: '瀑布流',
  list: '列表',
}

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
        { value: 'card', label: LABEL.card, icon: <AppstoreOutlined /> },
        { value: 'masonry', label: LABEL.masonry, icon: <PicCenterOutlined /> },
        { value: 'list', label: LABEL.list, icon: <BarsOutlined /> },
      ]}
    />
  )
}
