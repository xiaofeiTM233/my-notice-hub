// lib/server/import/registry.ts
import 'server-only'
import { zmdImportAdapter } from './adapters/zmd'
import { zmdWebImportAdapter } from './adapters/zmd-web'
import type { NoticeInput } from '@/lib/shared/contracts/notice'

export interface ImportSource {
  filename: string
  mime: string
  buffer: Buffer
}

export interface ImportAdapter {
  id: string
  label: string
  accepts: string[]
  // 远程适配器自行从来源接口取数，导入时不需要上传文件，source 缺省
  remote?: boolean
  description?: string
  parse(source?: ImportSource): Promise<unknown[]>
  // 写入前把正文外链资源落成媒体，需按相同顺序返回等长数组；预览阶段不调用
  materialize?(payload: NoticeInput[]): Promise<NoticeInput[]>
}

// 新增适配器：在同目录实现 ImportAdapter，再 push 进 importAdapters 即可，导入接口会自动列出。
export const importAdapters: ImportAdapter[] = [zmdImportAdapter, zmdWebImportAdapter]

export function getImportAdapter(id: string): ImportAdapter | undefined {
  return importAdapters.find((adapter) => adapter.id === id)
}

export function listImportAdapters(): {
  id: string
  label: string
  accepts: string[]
  remote: boolean
  description?: string
}[] {
  return importAdapters.map(({ id, label, accepts, remote, description }) => ({
    id,
    label,
    accepts,
    remote: remote ?? false,
    description,
  }))
}
