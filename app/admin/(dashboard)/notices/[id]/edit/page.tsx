// app/admin/(dashboard)/notices/[id]/edit/page.tsx
import { Suspense } from 'react'
import { NoticeForm } from '@/components/admin/NoticeForm'

export default function AdminNoticeEditPage({
  params,
}: PageProps<'/admin/notices/[id]/edit'>) {
  return (
    <Suspense
      fallback={
        <div className="admin-page">
          <div className="skeleton-block skeleton-page" />
        </div>
      }
    >
      <NoticeEditor params={params} />
    </Suspense>
  )
}

// URL 参数在 Suspense 内读取，避免阻塞整个后台页面的即时导航。
async function NoticeEditor({
  params,
}: {
  params: PageProps<'/admin/notices/[id]/edit'>['params']
}) {
  const { id } = await params
  return <NoticeForm mode="edit" noticeId={id} />
}
