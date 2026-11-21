// lib/shared/format.ts

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatDate(seconds?: number | null, withTime = false): string {
  if (!seconds) return '—'
  const date = new Date(seconds * 1000)
  const base = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return withTime ? `${base} ${pad(date.getHours())}:${pad(date.getMinutes())}` : base
}

export function formatRelative(seconds?: number | null): string {
  if (!seconds) return '—'
  const diff = Math.floor(Date.now() / 1000) - seconds
  // 活动公告以活动开始时间入库，未来时间要显示开始日期，不能按「刚刚」处理
  if (diff < 0) return `${formatDate(seconds)} 开始`
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} 天前`
  return formatDate(seconds)
}

export function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function toSeconds(value: Date | string | number | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'number') return value
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(time) ? Math.floor(time / 1000) : undefined
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max)}…`
}
