// app/admin/(dashboard)/notices/page.tsx
import { Suspense } from 'react'
import { NoticeAdminList } from '@/components/admin/NoticeAdminList'

export default function AdminNoticesPage() {
  return (
    <Suspense fallback={null}>
      <NoticeAdminList />
    </Suspense>
  )
}
