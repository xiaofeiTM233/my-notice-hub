// components/site/PaginationBar.tsx
'use client'
import { Pagination } from 'antd'
import { DEFAULT_PAGE_SIZE } from '@/lib/shared/constants'

interface PaginationBarProps {
  page: number
  pageSize?: number
  total: number
  onChange: (page: number) => void
}

export function PaginationBar({ page, pageSize = DEFAULT_PAGE_SIZE, total, onChange }: PaginationBarProps) {
  if (total <= pageSize) return null

  return (
    <div className="pagination-wrap">
      <Pagination
        current={page}
        pageSize={pageSize}
        total={total}
        showSizeChanger={false}
        hideOnSinglePage
        onChange={onChange}
      />
    </div>
  )
}
