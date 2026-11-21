// app/api/cron/import/route.ts
import { randomUUID } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { withApi } from '@/lib/server/respond'
import { unauthorized } from '@/lib/server/errors'
import { runAutoImport } from '@/lib/server/import/run'

// 未配置环境变量时用进程内随机密钥兜底，避免接口完全敞开
const FALLBACK_SECRET = randomUUID()

// Vercel Cron 固定带这两个标识，用它们识别平台调度请求
function isVercelCron(request: NextRequest): boolean {
  return (
    request.headers.get('user-agent') === 'vercel-cron/1.0' &&
    request.headers.has('x-vercel-cron-schedule')
  )
}

export const GET = withApi(async (request: NextRequest) => {
  const configured = process.env.CRON_SECRET?.trim()
  const authorization = request.headers.get('authorization')

  // 配置了密钥就只认 Bearer；未配置时放行 Vercel Cron 标记，保证零配置也能按日运行
  const authorized = configured
    ? authorization === `Bearer ${configured}`
    : authorization === `Bearer ${FALLBACK_SECRET}` || isVercelCron(request)

  if (!authorized) throw unauthorized('定时任务鉴权失败')

  return runAutoImport()
})
