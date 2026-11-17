// app/admin/(dashboard)/page.tsx
import { redirect } from 'next/navigation'

export default function AdminIndexPage() {
  redirect('/admin/notices')
}
