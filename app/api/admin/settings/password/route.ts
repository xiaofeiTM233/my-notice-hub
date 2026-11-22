// app/api/admin/settings/password/route.ts
import type { NextRequest } from 'next/server'
import dbConnect from '@/lib/db'
import { withApi } from '@/lib/server/respond'
import { readJson } from '@/lib/server/params'
import { requireAdmin } from '@/lib/server/guard'
import { badRequest } from '@/lib/server/errors'
import { hashPassword, verifyPassword } from '@/lib/server/auth-password'
import { passwordChangeSchema } from '@/lib/shared/contracts/settings'
import { Setting } from '@/lib/server/models/setting'
import { clearSettingCache, getSetting } from '@/lib/server/setting-store'

export const POST = withApi(async (request: NextRequest) => {
  await requireAdmin()
  const input = passwordChangeSchema.parse(await readJson(request))

  const setting = await getSetting()
  const valid = verifyPassword(
    input.currentPassword,
    setting.admin.passwordHash,
    setting.admin.passwordSalt,
  )
  if (!valid) throw badRequest('当前密码不正确')

  const { hash, salt } = hashPassword(input.newPassword)
  await dbConnect()
  await Setting.updateOne(
    { _id: 'singleton' },
    {
      $set: {
        'admin.passwordHash': hash,
        'admin.passwordSalt': salt,
        'admin.passwordUpdatedAt': Math.floor(Date.now() / 1000),
      },
      $inc: { 'admin.sessionVersion': 1 },
    },
  )
  clearSettingCache()

  // 会话版本已自增，当前 JWT 立即失效，前端需重新登录。
  return { changed: true }
})
