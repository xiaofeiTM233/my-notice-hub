// app/(site)/page.tsx
import { Suspense } from 'react'
import { NoticeBrowser } from '@/components/site/NoticeBrowser'

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="site-container">
          <div className="skeleton-block skeleton-page" />
        </div>
      }
    >
      <NoticeBrowser />
    </Suspense>
  )
}
