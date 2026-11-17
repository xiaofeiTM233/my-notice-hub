// lib/server/guard.ts
import 'server-only'
import { auth } from '@/auth'
import { getSetting } from './setting-store'
import { unauthorized } from './errors'

export async function requireAdmin() {
  const session = await auth()
  if (!session?.user) throw unauthorized()

  // 改密后 sessionVersion 自增，旧 JWT 立即失效。
  const setting = await getSetting()
  if ((session.sv ?? -1) !== setting.admin.sessionVersion) {
    throw unauthorized('会话已失效，请重新登录')
  }

  return session
}
