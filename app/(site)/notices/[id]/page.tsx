// app/(site)/notices/[id]/page.tsx
import { Suspense } from 'react'
import { NoticeDetailView } from '@/components/site/NoticeDetailView'

export default function NoticePage({ params }: PageProps<'/notices/[id]'>) {
  return (
    <Suspense
      fallback={
        <div className="site-container">
          <div className="skeleton-block skeleton-page" />
        </div>
      }
    >
      <NoticeContent params={params} />
    </Suspense>
  )
}

// URL 参数在 Suspense 内读取，导航时先出骨架再流式渲染正文。
async function NoticeContent({ params }: { params: PageProps<'/notices/[id]'>['params'] }) {
  const { id } = await params
  return <NoticeDetailView noticeId={id} />
}
