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

// 返回 null 表示尚未初始化，由首次登录请求补建；未命中不缓存，避免初始化后被一直当成缺失。
export async function getSettingOrNull(): Promise<ISetting | null> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value
  }

  await dbConnect()
  const setting = await Setting.findById('singleton').lean<ISetting | null>()
  if (setting) {
    cached = { value: setting, at: Date.now() }
  }
  return setting
}

export async function getSetting(): Promise<ISetting> {
  const setting = await getSettingOrNull()
  if (!setting) {
    throw internalError('站点尚未初始化，请重新提交一次登录完成初始化')
  }
  return setting
}
