// components/site/PaginationBar.tsx
'use client'
import { Pagination } from 'antd'
import { MAX_PAGE_SIZE } from '@/lib/shared/constants'

interface PaginationBarProps {
  page: number
  pageSize: number
  total: number
  onChange: (page: number, pageSize: number) => void
}

export function PaginationBar({ page, pageSize, total, onChange }: PaginationBarProps) {
  if (total <= pageSize) return null

  return (
    <div className="pagination-wrap">
      <Pagination
        current={page}
        pageSize={pageSize}
        total={total}
        showSizeChanger
        pageSizeOptions={[12, 24, 36, 60].filter((size) => size <= MAX_PAGE_SIZE)}
        showLessItems
        onChange={onChange}
      />
    </div>
  )
}
