// lib/server/import/commit.ts
import 'server-only'
import dbConnect from '@/lib/db'
import { Notice } from '@/lib/server/models/notice'
import { createNotice, updateNotice } from '@/lib/server/queries/notice'
import { noticeInputSchema, type NoticeInput } from '@/lib/shared/contracts/notice'
import { getImportAdapter } from './registry'

export interface CommitPayloadInput {
  adapterId: string
  payload: unknown[]
  channel?: string
  duplicate: 'skip' | 'overwrite'
}

export interface CommitReport {
  inserted: number
  skipped: number
  failed: number
}

async function findDuplicateId(notice: NoticeInput): Promise<string | null> {
  // 外部来源带稳定 cid 时按来源标识判重，否则同标题同时间的多条公告会互相跳过或覆盖
  const sourceId = typeof notice.extra?.cid === 'string' ? notice.extra.cid : ''
  const sourceName = typeof notice.extra?.source === 'string' ? notice.extra.source : ''
  const filter: Record<string, unknown> =
    sourceId && sourceName
      ? { 'meta.channel': notice.channel, 'extra.source': sourceName, 'extra.cid': sourceId }
      : { 'meta.timestamp': notice.timestamp, 'content.title': notice.title }

  const existing = await Notice.findOne(filter, { _id: 1 }).lean<{ _id: unknown } | null>()
  return existing ? String(existing._id) : null
}

export async function commitPayload(input: CommitPayloadInput): Promise<CommitReport> {
  await dbConnect()

  let inserted = 0
  let skipped = 0
  let failed = 0
  const now = Math.floor(Date.now() / 1000)

  // 先判重再落媒体：跳过重复条目的同时避免重复导入产生无主图片
  const pending: { existingId: string | null; notice: NoticeInput }[] = []
  for (const raw of input.payload) {
    const parsed = noticeInputSchema.safeParse(raw)
    if (!parsed.success) {
      failed += 1
      continue
    }

    const notice: NoticeInput = {
      ...parsed.data,
      channel: input.channel ?? parsed.data.channel,
      timestamp: parsed.data.timestamp ?? now,
    }
    const existingId = await findDuplicateId(notice)
    if (existingId && input.duplicate === 'skip') {
      skipped += 1
      continue
    }
    pending.push({ existingId, notice })
  }

  const adapter = getImportAdapter(input.adapterId)
  // materialize 需按相同顺序返回等长数组，与 pending 一一对应
  const prepared = adapter?.materialize
    ? await adapter.materialize(pending.map((item) => item.notice))
    : pending.map((item) => item.notice)

  for (let index = 0; index < prepared.length; index += 1) {
    const existingId = pending[index]?.existingId
    try {
      if (existingId) {
        await updateNotice(existingId, prepared[index])
      } else {
        await createNotice(prepared[index])
      }
      inserted += 1
    } catch {
      failed += 1
    }
  }

  return { inserted, skipped, failed }
}