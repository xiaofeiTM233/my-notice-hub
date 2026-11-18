// scripts/import-gamekee-ba.ts
import mongoose from 'mongoose'
import dbConnect from '../lib/db'
import { fetchGamekeeActivities } from '../lib/server/import/adapters/gamekee-ba'
import { commitPayload } from '../lib/server/import/commit'
import { Media } from '../lib/server/models/media'
import { Notice } from '../lib/server/models/notice'
import { noticeInputSchema } from '../lib/shared/contracts/notice'

interface Options {
  limit: number
  dryRun: boolean
  skipExisting: boolean
}

function parseArgs(argv: string[]): Options {
  const options: Options = { limit: 5000, dryRun: false, skipExisting: false }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--dry-run') {
      options.dryRun = true
    } else if (arg === '--skip-existing') {
      options.skipExisting = true
    } else if (arg === '--limit') {
      const value = Number(argv[index + 1])
      if (!Number.isInteger(value) || value <= 0) throw new Error('--limit 需要正整数')
      options.limit = value
      index += 1
    } else {
      throw new Error(`未知参数：${arg}`)
    }
  }

  return options
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  await dbConnect()

  const payload = await fetchGamekeeActivities(options.limit)
  const invalid = payload.filter((raw) => !noticeInputSchema.safeParse(raw).success)
  console.log(`拉取 ${payload.length} 条，可导入 ${payload.length - invalid.length} 条，异常 ${invalid.length} 条`)

  if (options.dryRun) {
    console.log('--dry-run：未写入数据库')
    return
  }

  const incoming = new Set(
    payload.map((raw) => String((raw as { extra?: { cid?: string } }).extra?.cid ?? '')),
  )
  const existing = await Notice.find(
    { 'meta.channel': 'ba', 'extra.source': 'gamekee-ba' },
    { 'extra.cid': 1 },
  ).lean<{ extra?: { cid?: string } }[]>()
  const existingCids = new Set(existing.map((doc) => doc.extra?.cid ?? ''))
  const existed = [...incoming].filter((cid) => existingCids.has(cid)).length
  console.log(
    `其中新增 ${incoming.size - existed} 条，已存在 ${existed} 条（${options.skipExisting ? '跳过' : '覆盖'}）`,
  )

  const mediaBefore = await Media.countDocuments({})
  const report = await commitPayload({
    adapterId: 'gamekee-ba',
    payload,
    duplicate: options.skipExisting ? 'skip' : 'overwrite',
  })
  const mediaAfter = await Media.countDocuments({})

  console.log(`写入完成：新增/更新 ${report.inserted}，跳过 ${report.skipped}，失败 ${report.failed}`)
  console.log(`媒体：新增 ${mediaAfter - mediaBefore} 条，当前共 ${mediaAfter} 条`)
}

main()
  .catch((error: unknown) => {
    console.error('导入失败', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })