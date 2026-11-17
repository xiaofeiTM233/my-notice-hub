// hooks/useApiQuery.ts
'use client'
import { useCallback, useEffect, useState } from 'react'
import { ApiError, apiFetch } from '@/lib/client/api'

export interface ApiQueryResult<T> {
  data: T | null
  loading: boolean
  error: ApiError | null
  refresh: () => void
}

interface QueryState<T> {
  key: string
  data: T | null
  error: ApiError | null
}

export function useApiQuery<T>(
  path: string | null,
  query?: Record<string, unknown>,
): ApiQueryResult<T> {
  const [tick, setTick] = useState(0)
  const [state, setState] = useState<QueryState<T>>({ key: '', data: null, error: null })

  // 依赖用序列化结果，避免调用方每次渲染传入新对象导致循环请求。
  const queryKey = JSON.stringify(query ?? {})
  const requestKey = path ? `${path}|${queryKey}|${tick}` : null

  useEffect(() => {
    if (!path || !requestKey) return

    const controller = new AbortController()
    const parsedQuery = JSON.parse(queryKey) as Record<string, unknown>

    apiFetch<T>(path, { query: parsedQuery, signal: controller.signal })
      .then((value) => {
        if (controller.signal.aborted) return
        setState({ key: requestKey, data: value, error: null })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setState({
          key: requestKey,
          data: null,
          error: error instanceof ApiError ? error : new ApiError(0, 'INTERNAL', '请求失败'),
        })
      })

    return () => controller.abort()
  }, [path, requestKey, queryKey])

  const refresh = useCallback(() => setTick((value) => value + 1), [])
  const samePath = path !== null && state.key.startsWith(`${path}|`)

  return {
    data: samePath ? state.data : null,
    error: samePath ? state.error : null,
    loading: requestKey !== null && state.key !== requestKey,
    refresh,
  }
}
