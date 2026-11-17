// app/not-found.tsx
import { Button, Result } from 'antd'
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="site-container" style={{ paddingTop: 48 }}>
      <Result
        status="404"
        title="页面不存在"
        subTitle="链接可能已失效，或文章已被删除。"
        extra={
          <Link href="/">
            <Button type="primary">返回列表</Button>
          </Link>
        }
      />
    </div>
  )
}
