// components/admin/LoginForm.tsx
'use client'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { Alert, App, Button, Form, Input } from 'antd'
import Image from 'next/image'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { SITE_NAME } from '@/lib/shared/constants'

interface LoginValues {
  username: string
  password: string
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nextPath = searchParams.get('next')
  const target = nextPath && nextPath.startsWith('/admin') ? nextPath : '/admin/notices'

  const handleFinish = async (values: LoginValues) => {
    setLoading(true)
    setError(null)
    try {
      const result = await signIn('credentials', {
        username: values.username.trim(),
        password: values.password,
        redirect: false,
      })
      if (!result || result.error) {
        setError('用户名或密码不正确，或尝试次数过多')
        return
      }
      message.success('登录成功')
      router.replace(target)
      router.refresh()
    } catch {
      setError('登录失败，请稍后再试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <Image src="/vercel.svg" alt="" width={24} height={24} />
          <span>{SITE_NAME}</span>
        </div>
        <p className="login-sub">管理后台，仅限管理员登录</p>

        {error ? (
          <Alert
            type="error"
            showIcon
            title={error}
            style={{ marginBottom: 16 }}
            closable
            onClose={() => setError(null)}
          />
        ) : null}

        <Form<LoginValues>
          layout="vertical"
          requiredMark={false}
          onFinish={handleFinish}
          autoComplete="off"
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input size="large" prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password size="large" prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={loading}>
            登录
          </Button>
        </Form>
      </div>
    </div>
  )
}
