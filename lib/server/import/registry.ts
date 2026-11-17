// lib/server/import/registry.ts
import 'server-only'

export interface ImportSource {
  filename: string
  mime: string
  buffer: Buffer
}

export interface ImportAdapter {
  id: string
  label: string
  accepts: string[]
  parse(source: ImportSource): Promise<unknown[]>
}

// 新增适配器：在同目录实现 ImportAdapter，再 push 进 importAdapters 即可，导入接口会自动列出。
export const importAdapters: ImportAdapter[] = []

export function getImportAdapter(id: string): ImportAdapter | undefined {
  return importAdapters.find((adapter) => adapter.id === id)
}

export function listImportAdapters(): { id: string; label: string; accepts: string[] }[] {
  return importAdapters.map(({ id, label, accepts }) => ({ id, label, accepts }))
}
