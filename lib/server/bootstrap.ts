// lib/server/bootstrap.ts
import 'server-only'
import dbConnect from '@/lib/db'
import {
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_USERNAME,
  DEFAULT_ALLOWED_FORMATS,
  UPLOAD_MAX_BYTES,
} from '@/lib/shared/constants'
import { hashPassword } from './auth-password'
import { internalError } from './errors'
import { Setting, type ISetting } from './models/setting'
import { clearSettingCache, getSettingOrNull } from './setting-store'

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  )
}

// 初始密码取 ADMIN_INIT_PASSWORD，未配置时用 constants 里的约定值；_id 唯一索引负责收敛并发首登。
async function createSetting(): Promise<ISetting> {
  const password = process.env.ADMIN_INIT_PASSWORD || DEFAULT_ADMIN_PASSWORD
  const { hash, salt } = hashPassword(password)

  try {
    const created = await Setting.findByIdAndUpdate(
      'singleton',
      {
        $setOnInsert: {
          admin: {
            username: DEFAULT_ADMIN_USERNAME,
            passwordHash: hash,
            passwordSalt: salt,
            passwordUpdatedAt: Math.floor(Date.now() / 1000),
            sessionVersion: 0,
          },
          media: {
            type: 'base64',
            maxUploadSize: UPLOAD_MAX_BYTES,
            allowedFormats: [...DEFAULT_ALLOWED_FORMATS],
          },
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).lean<ISetting | null>()

    if (created) {
      clearSettingCache()
      console.log(`[bootstrap] 站点设置已初始化，用户名 ${DEFAULT_ADMIN_USERNAME}`)
      return created
    }
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error
  }

  const existing = await Setting.findById('singleton').lean<ISetting | null>()
  if (!existing) {
    throw internalError('站点设置初始化失败')
  }
  return existing
}

// 单例设置在首次登录请求时补建，返回后调用方仍按提交的账号密码校验。
export async function ensureSetting(): Promise<ISetting> {
  const existing = await getSettingOrNull()
  if (existing) {
    return existing
  }

  await dbConnect()
  return createSetting()
}
