// app/admin/(dashboard)/notices/[id]/edit/page.tsx
import { NoticeForm } from '@/components/admin/NoticeForm'

export default async function AdminNoticeEditPage({
  params,
}: PageProps<'/admin/notices/[id]/edit'>) {
  const { id } = await params
  return <NoticeForm mode="edit" noticeId={id} />
}
