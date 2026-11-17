// scripts/import-zmd-archive.ts
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import mongoose from 'mongoose'
import dbConnect from '../lib/db'
import { zmdImportAdapter } from '../lib/server/import/adapters/zmd'
import { commitPayload } from '../lib/server/import/commit'
import { Media } from '../lib/server/models/media'
import { Notice } from '../lib/server/models/notice'
import { noticeInputSchema } from '../lib/shared/contracts/notice'

const REPO = 'BiologyHazard/endfield-archive-library'
const REPO_REF = 'main'
const ARCHIVE_PATH = 'https/game-hub.hypergryph.com/bulletin/detail'
const FILE_NAME = 'lang=zh-cn&code=endfield_5SD9TN.json'
const GITHUB_API = `https://api.github.com/repos/${REPO}/contents/${ARCHIVE_PATH}?ref=${REPO_REF}`
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${REPO_REF}/${ARCHIVE_PATH}`
const MIRROR_BASE = `https://cdn.jsdelivr.net/gh/${REPO}@${REPO_REF}/${ARCHIVE_PATH}`
const DOWNLOAD_CONCURRENCY = 4
const FETCH_TIMEOUT_MS = 20_000

interface Options {
  dir?: string
  dryRun: boolean
  skipExisting: boolean
  limit?: number
}

function parseArgs(argv: string[]): Options {
  const options: Options = { dryRun: false, skipExisting: false }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--dry-run') {
      options.dryRun = true
    } else if (arg === '--skip-existing') {
      options.skipExisting = true
    } else if (arg === '--dir') {
      const value = argv[index + 1]
      if (!value) throw new Error('--dir 需要指定归档 detail 目录')
      options.dir = value
      index += 1
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

async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    return response.ok ? await response.text() : null
  } catch {
    return null
  }
}

async function listCids(dir?: string): Promise<string[]> {
  if (dir) {
    const entries = await readdir(dir, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
  }

  const text = await fetchText(GITHUB_API)
  if (!text) throw new Error('读取 GitHub 归档目录失败')
  const entries = JSON.parse(text) as { name: string; type: string }[]
  return entries
    .filter((entry) => entry.type === 'dir')
    .map((entry) => entry.name)
    .sort()
}

async function loadArchiveFile(cid: string, dir?: string): Promise<Buffer> {
  if (dir) return readFile(join(dir, cid, FILE_NAME))

  // GitHub raw 偶发连接超时，失败后回退 jsDelivr 镜像
  const encoded = encodeURIComponent(FILE_NAME)
  for (const base of [RAW_BASE, MIRROR_BASE]) {
    const text = await fetchText(`${base}/${cid}/${encoded}`)
    if (text) return Buffer.from(text)
  }
  throw new Error(`下载归档文件失败：${cid}`)
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  await dbConnect()

  const allCids = await listCids(options.dir)
  const cids = options.limit ? allCids.slice(0, options.limit) : allCids
  console.log(`归档来源：${options.dir ?? REPO}，共 ${cids.length} 条`)

  const run = createLimiter(DOWNLOAD_CONCURRENCY)
  const files = await Promise.all(
    cids.map((cid) =>
      run(async () => {
        try {
          return { cid, buffer: await loadArchiveFile(cid, options.dir) }
        } catch (error) {
          console.warn('读取归档失败，跳过', cid, error instanceof Error ? error.message : error)
          return { cid, buffer: null }
        }
      }),
    ),
  )

  const payload: unknown[] = []
  let abnormal = 0
  for (const file of files) {
    if (!file.buffer) {
      abnormal += 1
      continue
    }
    try {
      const raws = await zmdImportAdapter.parse({
        filename: FILE_NAME,
        mime: 'application/json',
        buffer: file.buffer,
      })
      for (const raw of raws) {
        if (noticeInputSchema.safeParse(raw).success) payload.push(raw)
        else {
          abnormal += 1
          console.warn('字段校验失败，跳过', file.cid)
        }
      }
    } catch (error) {
      abnormal += 1
      console.warn('解析归档失败，跳过', file.cid, error instanceof Error ? error.message : error)
    }
  }
  console.log(`可导入 ${payload.length} 条，异常 ${abnormal} 条`)

  if (options.dryRun) {
    console.log('--dry-run：未写入数据库')
    return
  }

  const incoming = new Set(
    payload.map((raw) => String((raw as { extra?: { cid?: string } }).extra?.cid ?? '')),
  )
  const existing = await Notice.find(
    { 'meta.channel': 'zmd', 'extra.source': 'zmd' },
    { 'extra.cid': 1 },
  ).lean<{ extra?: { cid?: string } }[]>()
  const existingCids = new Set(existing.map((doc) => doc.extra?.cid ?? ''))
  const existed = [...incoming].filter((cid) => existingCids.has(cid)).length
  console.log(
    `其中新增 ${incoming.size - existed} 条，已存在 ${existed} 条（${options.skipExisting ? '跳过' : '覆盖'}）`,
  )

  const mediaBefore = await Media.countDocuments({})
  const report = await commitPayload({
    adapterId: 'zmd',
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