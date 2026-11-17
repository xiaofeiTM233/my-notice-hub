// lib/server/setting-store.ts
import 'server-only'
import dbConnect from '@/lib/db'
import { Setting, type ISetting } from './models/setting'
import { internalError } from './errors'

// 设置被媒体读取路径频繁使用，短缓存降低数据库压力；写入后主动失效。
const CACHE_TTL_MS = 30_000

let cached: { value: ISetting; at: number } | null = null

export function clearSettingCache(): void {
  cached = null
}

export async function getSetting(): Promise<ISetting> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value
  }

  await dbConnect()
  const setting = await Setting.findById('singleton').lean<ISetting | null>()
  if (!setting) {
    throw internalError('站点尚未初始化，请先执行 npm run seed')
  }

  cached = { value: setting, at: Date.now() }
  return setting
}
