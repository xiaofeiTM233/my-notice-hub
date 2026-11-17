// components/site/ViewSwitch.tsx
'use client'
import { Segmented } from 'antd'
import { LIST_VIEWS, LIST_VIEW_LABEL, type ListView } from '@/lib/shared/constants'

interface ViewSwitchProps {
  value: ListView
  onChange: (view: ListView) => void
}

export function ViewSwitch({ value, onChange }: ViewSwitchProps) {
  return (
    <Segmented
      aria-label="切换列表视图"
      value={value}
      onChange={(next) => onChange(next as ListView)}
      options={LIST_VIEWS.map((item) => ({ value: item, label: LIST_VIEW_LABEL[item] }))}
    />
  )
}
