// lib/server/import/run.ts
// lib/server/import/run.ts
import 'server-only'
import dbConnect from '@/lib/db'
import { badRequest, conflict } from '@/lib/server/errors'
import { Setting, type SettingAutoImport } from '@/lib/server/models/setting'
import { Notice } from '@/lib/server/models/notice'
import { clearSettingCache, getSetting } from '@/lib/server/setting-store'
import { AUTO_IMPORT_DEFAULT_LIMIT, AUTO_IMPORT_MAX_LIMIT } from '@/lib/shared/constants'
import { commitPayload } from './commit'
import { importAdapters } from './registry'

// 锁只防并发，不记录历史；进程异常时最多阻塞这么久
const RUN_LOCK_MS = 5 * 60 * 1000

export interface ImportRunAdapterReport {
  adapter: string
  label: string
  inserted: number
  skipped: number
  failed: number
  error?: string
}

export interface ImportRunReport {
  // false 表示自动导入未启用，本次没有执行
  ran: boolean
  adapters: ImportRunAdapterReport[]
}

// 老库文档没有 autoImport 字段，统一在读取处补默认值
function resolveConfig(value?: SettingAutoImport): SettingAutoImport {
  return {
    enabled: value?.enabled ?? false,
    adapters: value?.adapters ?? [],
    limit: Math.min(Math.max(value?.limit ?? AUTO_IMPORT_DEFAULT_LIMIT, 1), AUTO_IMPORT_MAX_LIMIT),
    duplicate: value?.duplicate ?? 'skip',
  }
}

async function acquireLock(): Promise<boolean> {
  await dbConnect()
  const result = await Setting.updateOne(
    { _id: 'singleton', 'autoImport.lockAt': { $not: { $gt: Date.now() - RUN_LOCK_MS } } },
    { $set: { 'autoImport.lockAt': Date.now() } },
  )
  clearSettingCache()
  return result.matchedCount > 0
}

async function releaseLock(): Promise<void> {
  await Setting.updateOne({ _id: 'singleton' }, { $unset: { 'autoImport.lockAt': '' } })
  clearSettingCache()
}

// 远程适配器约定 extra.source 等于适配器 id，据此找出已入库的来源标识
async function loadExistingCids(adapterId: string): Promise<string[]> {
  await dbConnect()
  const docs = await Notice.find(
    { 'extra.source': adapterId, 'extra.cid': { $exists: true, $ne: '' } },
    { 'extra.cid': 1 },
  ).lean<{ extra?: { cid?: string } }[]>()
  const cids: string[] = []
  for (const doc of docs) {
    const cid = doc.extra?.cid
    if (cid) cids.push(cid)
  }
  return cids
}

// 执行一次自动导入，定时路由与后台「立即运行」共用
// force 为 true 时忽略 enabled 开关，便于配置后先手动验证
export async function runAutoImport(options?: { force?: boolean }): Promise<ImportRunReport> {
  const setting = await getSetting()
  const config = resolveConfig(setting.autoImport)

  if (!config.enabled && !options?.force) {
    return { ran: false, adapters: [] }
  }

  const selected = importAdapters.filter(
    (adapter) => adapter.remote && config.adapters.includes(adapter.id),
  )
  if (selected.length === 0) throw badRequest('尚未在设置中选择可自动导入的来源')

  if (!(await acquireLock())) throw conflict('已有导入任务在运行，请稍后重试')

  const reports: ImportRunAdapterReport[] = []
  try {
    for (const adapter of selected) {
      try {
        const skipCids = await loadExistingCids(adapter.id)
        const payload = await adapter.parse(undefined, { limit: config.limit, skipCids })
        const report = await commitPayload({
          adapterId: adapter.id,
          payload,
          duplicate: config.duplicate,
        })
        reports.push({ adapter: adapter.id, label: adapter.label, ...report })
      } catch (error) {
        reports.push({
          adapter: adapter.id,
          label: adapter.label,
          inserted: 0,
          skipped: 0,
          failed: 0,
          error: error instanceof Error ? error.message : '导入失败',
        })
      }
    }
  } finally {
    try {
      await releaseLock()
    } catch {
      // 释放失败时由 TTL 兜底，不能覆盖本次导入结果
    }
  }

  return { ran: true, adapters: reports }
}
