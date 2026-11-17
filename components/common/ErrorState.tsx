// components/common/ErrorState.tsx
'use client'
import { Alert, Button } from 'antd'

interface ErrorStateProps {
  message: string
  requestId?: string
  onRetry?: () => void
}

export function ErrorState({ message, requestId, onRetry }: ErrorStateProps) {
  return (
    <Alert
      type="error"
      showIcon
      title={message}
      description={requestId ? `请求编号：${requestId}` : undefined}
      action={
        onRetry ? (
          <Button size="small" onClick={onRetry}>
            重试
          </Button>
        ) : undefined
      }
    />
  )
}
