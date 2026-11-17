// app/api/admin/settings/route.ts
import type { NextRequest } from 'next/server'
import { withApi } from '@/lib/server/respond'
import { readJson } from '@/lib/server/params'
import { requireAdmin } from '@/lib/server/guard'
import { settingsPatchSchema } from '@/lib/shared/contracts/settings'
import { STORAGE_CREDENTIAL_KEYS } from '@/lib/shared/constants'
import { Setting } from '@/lib/server/models/setting'
import { clearSettingCache, getSetting } from '@/lib/server/setting-store'
import { toSettingDto } from '@/lib/server/dto'
import dbConnect from '@/lib/db'

export const GET = withApi(async () => {
  await requireAdmin()
  return toSettingDto(await getSetting())
})

export const PATCH = withApi(async (request: NextRequest) => {
  await requireAdmin()
  const patch = settingsPatchSchema.parse(await readJson(request))

  const set: Record<string, unknown> = {}
  const unset: Record<string, unknown> = {}

  if (patch.admin?.username !== undefined) set['admin.username'] = patch.admin.username
  if (patch.media?.type !== undefined) set['media.type'] = patch.media.type
  if (patch.media?.maxUploadSize !== undefined) set['media.maxUploadSize'] = patch.media.maxUploadSize
  if (patch.media?.allowedFormats !== undefined) {
    set['media.allowedFormats'] = patch.media.allowedFormats.map((format) => format.toLowerCase())
  }

  for (const [key, value] of Object.entries(patch.media?.credentials ?? {})) {
    if (!(STORAGE_CREDENTIAL_KEYS as readonly string[]).includes(key)) continue
    if (value === null || value === '') {
      unset[`media.${key}`] = ''
      continue
    }
    set[`media.${key}`] = value
  }

  if (Object.keys(set).length > 0 || Object.keys(unset).length > 0) {
    await dbConnect()
    await Setting.updateOne(
      { _id: 'singleton' },
      {
        ...(Object.keys(set).length > 0 ? { $set: set } : {}),
        ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
      },
    )
    clearSettingCache()
  }

  return toSettingDto(await getSetting())
})
