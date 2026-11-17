// lib/shared/contracts/media.ts
import { z } from 'zod'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MEDIA_TYPES } from '@/lib/shared/constants'

export const mediaTypeSchema = z.enum(MEDIA_TYPES)

export const mediaQuerySchema = z.object({
  q: z.string().trim().max(80).default(''),
  type: mediaTypeSchema.optional(),
  format: z.string().trim().max(10).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE * 2),
})

export const mediaUpdateSchema = z.object({
  name: z.string().trim().max(120).optional(),
  author: z
    .object({
      name: z.string().trim().max(60).optional(),
      avatar: z.string().trim().optional(),
    })
    .optional(),
})

export const mediaDtoSchema = z.object({
  id: z.string(),
  type: mediaTypeSchema,
  format: z.string(),
  name: z.string(),
  author: z
    .object({
      name: z.string().optional(),
      avatar: z.string().optional(),
    })
    .nullable(),
  url: z.string(),
  size: z.number().optional(),
})

export type MediaUpdateInput = z.infer<typeof mediaUpdateSchema>
export type MediaQueryInput = z.infer<typeof mediaQuerySchema>
