// app/(site)/notices/[id]/page.tsx
import { NoticeDetailView } from '@/components/site/NoticeDetailView'

export default async function NoticePage({ params }: PageProps<'/notices/[id]'>) {
  const { id } = await params
  return <NoticeDetailView noticeId={id} />
}
