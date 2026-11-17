// lib/shared/contracts/import.ts
import { z } from 'zod'
import { objectIdSchema } from './common'

export const importParseSchema = z.object({
  adapter: z.string().trim().min(1),
})

export const importCommitSchema = z.object({
  jobId: objectIdSchema,
  channel: z.string().trim().min(1).max(60).optional(),
  duplicate: z.enum(['skip', 'overwrite']).default('skip'),
})

export const importAdapterSchema = z.object({
  id: z.string(),
  label: z.string(),
  accepts: z.array(z.string()),
  remote: z.boolean(),
  description: z.string().optional(),
})

export type ImportCommitInput = z.infer<typeof importCommitSchema>
