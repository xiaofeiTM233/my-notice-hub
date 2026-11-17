// app/api/admin/settings/storage/test/route.ts
import type { NextRequest } from 'next/server'
import { withApi } from '@/lib/server/respond'
import { readJson } from '@/lib/server/params'
import { requireAdmin } from '@/lib/server/guard'
import { badRequest, storageError } from '@/lib/server/errors'
import { storageTestSchema } from '@/lib/shared/contracts/settings'
import { createAdapter } from '@/lib/media'
import { getSetting } from '@/lib/server/setting-store'

// 1×1 透明 PNG，用于验证写入、读回、删除三个动作。
const TEST_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/wD/6X8kAAAAAElFTkSuQmCC',
  'base64',
)

export const POST = withApi(async (request: NextRequest) => {
  await requireAdmin()
  const input = storageTestSchema.parse(await readJson(request).catch(() => ({})))

  const setting = await getSetting()
  const config = input.type ? { ...setting.media, type: input.type } : setting.media
  if (config.type === 'url') {
    throw badRequest('外部链接类型不支持写入测试')
  }

  const startedAt = Date.now()
  try {
    const adapter = await createAdapter(config, config.type)
    const saved = await adapter.save('storage-test.png', TEST_PNG, 'png')
    const loaded = await adapter.load(saved.src)
    if (loaded.length !== TEST_PNG.length) {
      throw storageError('读回内容长度与写入不一致')
    }
    await adapter.remove(saved.src)
    return { ok: true, type: config.type, tookMs: Date.now() - startedAt }
  } catch (error) {
    const message = error instanceof Error ? error.message : '存储连通性测试失败'
    throw storageError(message, { type: config.type })
  }
})
