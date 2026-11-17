// app/error.tsx
'use client'
import { Button, Result } from 'antd'
import Link from 'next/link'

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="site-container" style={{ paddingTop: 48 }}>
      <Result
        status="error"
        title="页面出错了"
        subTitle="可以重试一次，或返回列表页。"
        extra={[
          <Button key="retry" type="primary" onClick={reset}>
            重试
          </Button>,
          <Link key="home" href="/">
            <Button>返回列表</Button>
          </Link>,
        ]}
      />
    </div>
  )
}
