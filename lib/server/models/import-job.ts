// lib/server/models/import-job.ts
import { Schema, model, models, type Model, type Types } from 'mongoose'

export interface ImportJobInvalid {
  index: number
  path: string
  message: string
}

export interface IImportJob {
  _id: Types.ObjectId
  adapter: string
  filename: string
  mime: string
  size: number
  status: 'parsed' | 'committed'
  total: number
  validCount: number
  invalidCount: number
  invalid: ImportJobInvalid[]
  payload: unknown[]
  createdAt: Date
  expiresAt: Date
}

const invalidSchema = new Schema<ImportJobInvalid>(
  {
    index: { type: Number, required: true },
    path: { type: String, required: true },
    message: { type: String, required: true },
  },
  { _id: false },
)

const importJobSchema = new Schema<IImportJob>(
  {
    adapter: { type: String, required: true },
    filename: { type: String, required: true },
    mime: { type: String, required: true },
    size: { type: Number, required: true },
    status: { type: String, enum: ['parsed', 'committed'], default: 'parsed', required: true },
    total: { type: Number, required: true },
    validCount: { type: Number, required: true },
    invalidCount: { type: Number, required: true },
    invalid: { type: [invalidSchema], default: [] },
    payload: { type: [Schema.Types.Mixed], default: [] },
    createdAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
)

// 过期即由 MongoDB 回收，避免暂存数据长期占用空间。
importJobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const ImportJob: Model<IImportJob> =
  (models.ImportJob as Model<IImportJob> | undefined) ?? model<IImportJob>('ImportJob', importJobSchema)
