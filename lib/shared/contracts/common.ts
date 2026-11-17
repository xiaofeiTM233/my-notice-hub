// lib/shared/contracts/common.ts
import { z } from 'zod'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/lib/shared/constants'

export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'ID 格式不正确')

export const paginationQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
})

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export const API_ERROR_CODES = [
  'BAD_REQUEST',
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'STORAGE_ERROR',
  'UPSTREAM_ERROR',
  'INTERNAL',
] as const

export type ApiErrorCodeValue = (typeof API_ERROR_CODES)[number]
