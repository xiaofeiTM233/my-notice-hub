// hooks/useNoticeFilters.ts
'use client'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import {
  parseNoticeQuery,
  serializeNoticeQuery,
  type NoticeQuery,
} from '@/lib/shared/notice-query'

export interface NoticeFilters {
  query: NoticeQuery
  apply: (patch: Partial<NoticeQuery>) => void
  reset: () => void
  filtered: boolean
}

export function useNoticeFilters(): NoticeFilters {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const searchKey = searchParams.toString()

  const query = useMemo(
    () => parseNoticeQuery(new URLSearchParams(searchKey)),
    [searchKey],
  )

  const apply = useCallback(
    (patch: Partial<NoticeQuery>) => {
      const next: NoticeQuery = { ...query, ...patch }
      if (patch.page === undefined) next.page = 1
      const queryString = serializeNoticeQuery(next)
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
    },
    [query, router, pathname],
  )

  const reset = useCallback(() => {
    router.replace(pathname, { scroll: false })
  }, [router, pathname])

  return { query, apply, reset, filtered: searchKey.length > 0 }
}
