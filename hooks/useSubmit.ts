// hooks/useSubmit.ts
'use client'
import { App } from 'antd'
import { useCallback, useState } from 'react'
import { ApiError } from '@/lib/client/api'

export interface SubmitOptions {
  success?: string
  onError?: (message: string) => void
}

export function useSubmit(): {
  loading: boolean
  run: <T>(task: () => Promise<T>, options?: SubmitOptions) => Promise<T | null>
} {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)

  const run = useCallback(
    async <T>(task: () => Promise<T>, options?: SubmitOptions): Promise<T | null> => {
      setLoading(true)
      try {
        const result = await task()
        if (options?.success) message.success(options.success)
        return result
      } catch (error) {
        const text =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : '操作失败'
        if (options?.onError) options.onError(text)
        else message.error(text)
        return null
      } finally {
        setLoading(false)
      }
    },
    [message],
  )

  return { loading, run }
}
