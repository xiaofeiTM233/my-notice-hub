// scripts/dedupe-media.ts
import mongoose, { type Types } from 'mongoose'
import dbConnect from '../lib/db'
import { fetchRemoteHash, hashBuffer, mediaUrl } from '../lib/media'
import { Media, type IMedia } from '../lib/server/models/media'
import { Notice } from '../lib/server/models/notice'

const DOWNLOAD_CONCURRENCY = 6

interface Options {
  dryRun: boolean
  limit?: number
}

function parseArgs(argv: string[]): Options {
  const options: Options = { dryRun: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--dry-run') {
      options.dryRun = true
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

function createLimiter(limit: number) {
  let active = 0
  const waiting: (() => void)[] = []
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active >= limit) await new Promise<void>((resolve) => waiting.push(resolve))
    active += 1
    try {
      return await task()
    } finally {
      active -= 1
      waiting.shift()?.()
    }
  }
}

async function contentHash(media: IMedia): Promise<string> {
  if (media.type === 'base64') {
    return hashBuffer(Buffer.from(media.src.replace(/^data:[^;]+;base64,/, ''), 'base64'))
  }
  if (media.type === 'url') {
    const { hash } = await fetchRemoteHash(media.src, media.referer)
    return hash
  }
  // 其余存储类型拿不到字节，保持原值
  return media.hash ?? ''
}

// 把文章里对被删媒体的引用改指向保留的那条
async function repointReferences(fromId: string, toId: string): Promise<number> {
  const pattern = new RegExp(fromId, 'g')
  let touched = 0

  const covers = await Notice.updateMany({ 'content.cover': fromId }, { $set: { 'content.cover': toId } })
  touched += covers.modifiedCount ?? 0
  const entities = await Notice.updateMany(
    { 'content.entities': fromId },
    { $set: { 'content.entities.$[target]': toId } },
    { arrayFilters: [{ target: fromId }] } as Record<string, unknown>,
  )
  touched += entities.modifiedCount ?? 0
  const avatars = await Notice.updateMany(
    { 'content.author.avatar': fromId },
    { $set: { 'content.author.avatar': toId } },
  )
  touched += avatars.modifiedCount ?? 0

  const bodies = await Notice.find({ 'content.body': { $regex: fromId } }, { 'content.body': 1 }).lean<
    { _id: Types.ObjectId; content: { body?: string } }[]
  >()
  for (const doc of bodies) {
    const next = String(doc.content.body ?? '').replace(pattern, toId)
    if (next === doc.content.body) continue
    await Notice.updateOne({ _id: doc._id }, { $set: { 'content.body': next } })
    touched += 1
  }

  const mediaAvatars = await Media.updateMany({ 'author.avatar': fromId }, { $set: { 'author.avatar': toId } })
  touched += mediaAvatars.modifiedCount ?? 0
  return touched
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  await dbConnect()

  const query = options.limit ? Media.find({}).limit(options.limit) : Media.find({})
  const docs = await query.lean<IMedia[]>()
  console.log(`待处理媒体 ${docs.length} 条`)

  const run = createLimiter(DOWNLOAD_CONCURRENCY)
  const hashed = await Promise.all(
    docs.map((doc) =>
      run(async () => {
        try {
          return { doc, hash: await contentHash(doc) }
        } catch (error) {
          console.warn('计算哈希失败，跳过', String(doc._id), error instanceof Error ? error.message : error)
          return { doc, hash: doc.hash ?? '' }
        }
      }),
    ),
  )

  const groups = new Map<string, IMedia[]>()
  for (const { doc, hash } of hashed) {
    if (!hash) continue
    groups.set(hash, [...(groups.get(hash) ?? []), doc])
  }

  let removed = 0
  let repointed = 0
  let hashUpdated = 0

  for (const [hash, list] of groups) {
    // 保留最早入库的那条，其余合并过去
    const [keep, ...rest] = [...list].sort((a, b) => String(a._id).localeCompare(String(b._id)))
    if (keep.hash !== hash) {
      if (!options.dryRun) await Media.updateOne({ _id: keep._id }, { $set: { hash } })
      hashUpdated += 1
    }

    for (const duplicate of rest) {
      const fromId = String(duplicate._id)
      const toId = String(keep._id)
      console.log(`合并 ${fromId} → ${toId}（${duplicate.name ?? ''}）`)
      if (options.dryRun) {
        removed += 1
        continue
      }
      repointed += await repointReferences(fromId, toId)
      await Media.deleteOne({ _id: duplicate._id })
      removed += 1
    }
  }

  console.log(
    `${options.dryRun ? '[dry-run] ' : ''}哈希更新 ${hashUpdated} 条，合并删除 ${removed} 条，改写引用 ${repointed} 处`,
  )
  if (removed > 0 && !options.dryRun) {
    console.log(`媒体剩余 ${await Media.countDocuments({})} 条，例如保留项 ${mediaUrl(String(groups.values().next().value?.[0]?._id ?? ''))}`)
  }
}

main()
  .catch((error: unknown) => {
    console.error('去重失败', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
