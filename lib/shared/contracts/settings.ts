// lib/shared/contracts/settings.ts
import { z } from 'zod'
import {
  AUTO_IMPORT_MAX_LIMIT,
  MEDIA_TYPES,
  UPLOAD_MAX_BYTES,
} from '@/lib/shared/constants'

export const settingsPatchSchema = z.object({
  admin: z
    .object({
      username: z.string().trim().min(1).max(40).optional(),
    })
    .optional(),
  media: z
    .object({
      type: z.enum(MEDIA_TYPES).optional(),
      maxUploadSize: z.number().int().min(1024).max(UPLOAD_MAX_BYTES).optional(),
      allowedFormats: z.array(z.string().trim().min(1).max(12)).min(1).max(30).optional(),
      credentials: z.record(z.string(), z.string().nullable()).optional(),
    })
    .optional(),
  autoImport: z
    .object({
      enabled: z.boolean().optional(),
      adapters: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
      limit: z.number().int().min(1).max(AUTO_IMPORT_MAX_LIMIT).optional(),
      duplicate: z.enum(['skip', 'overwrite']).optional(),
    })
    .optional(),
})

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, '请输入当前密码'),
  newPassword: z.string().min(1, '请输入新密码'),
})

export const storageTestSchema = z.object({
  type: z.enum(MEDIA_TYPES).optional(),
})

export type SettingsPatchInput = z.infer<typeof settingsPatchSchema>
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>
