// app/admin/login/page.tsx
import { Suspense } from 'react'
import { LoginForm } from '@/components/admin/LoginForm'

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="login-shell" />}>
      <LoginForm />
    </Suspense>
  )
}
