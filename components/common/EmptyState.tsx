// components/common/EmptyState.tsx
import { Empty } from 'antd'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  title?: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ title = '暂无内容', description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <div>
            <div className="empty-title">{title}</div>
            {description ? <div className="empty-desc">{description}</div> : null}
          </div>
        }
      >
        {action}
      </Empty>
    </div>
  )
}
