// scripts/check-admin.ts
import mongoose from 'mongoose'
import dbConnect from '../lib/db'
import { Setting } from '../lib/server/models/setting'
import { hashPassword, verifyPassword } from '../lib/server/auth-password'
import { formatDate } from '../lib/shared/format'

function parseArgs(): { password?: string; reset?: string } {
  const passwordArg = process.argv.slice(2).find((arg) => !arg.startsWith('--'))
  const resetArg = process.argv.find((arg) => arg.startsWith('--reset='))?.slice('--reset='.length)
  return { password: passwordArg, reset: resetArg }
}

async function main(): Promise<void> {
  const { password, reset } = parseArgs()

  console.log('MONGODB_URI:', process.env.MONGODB_URI ? '已设置' : '未设置（.env.local 没有被读取？）')
  console.log('AUTH_SECRET:', process.env.AUTH_SECRET ? '已设置' : '未设置（登录会直接失败）')

  if (!process.env.MONGODB_URI) {
    process.exitCode = 1
    return
  }

  await dbConnect()
  console.log('数据库连接: 正常')

  const setting = await Setting.findById('singleton').lean()
  if (!setting) {
    console.log('settings/singleton: 不存在 —— 先执行 npm run seed')
    process.exitCode = 1
    return
  }

  console.log('用户名:', setting.admin.username)
  console.log('密码更新时间:', formatDate(setting.admin.passwordUpdatedAt, true))
  console.log('会话版本:', setting.admin.sessionVersion)

  if (reset) {
    const { hash, salt } = hashPassword(reset)
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
    console.log('密码已重置为新值，旧会话全部失效')
    return
  }

  if (password) {
    const ok = verifyPassword(password, setting.admin.passwordHash, setting.admin.passwordSalt)
    console.log('密码校验:', ok ? '通过' : '不匹配（当前密码不是这个值）')
    if (!ok) process.exitCode = 1
    return
  }

  console.log('提示：把密码作为参数传入可校验，例如 npm run admin:check -- 你的密码')
}

main()
  .catch((error) => {
    console.error('检查失败：', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.connection.close().catch(() => undefined)
  })
