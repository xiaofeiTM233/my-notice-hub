// lib/server/models/media.ts
import { Schema, model, models, type Model, type Types } from 'mongoose'
import { MEDIA_TYPES, type MediaType } from '@/lib/shared/constants'
import type { NoticeAuthor } from './notice'

export interface IMedia {
  _id: Types.ObjectId
  type: MediaType
  src: string
  format: string
  name?: string
  author?: NoticeAuthor
  // 外链媒体代理时附带的来源页，部分图床会校验
  referer?: string
}

const authorSchema = new Schema<NoticeAuthor>(
  {
    name: { type: String, trim: true },
    avatar: { type: String, trim: true },
  },
  { _id: false },
)

const mediaSchema = new Schema<IMedia>(
  {
    type: { type: String, enum: MEDIA_TYPES, required: true },
    src: { type: String, required: true },
    format: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, trim: true },
    author: { type: authorSchema, default: undefined },
    referer: { type: String, trim: true, default: undefined },
  },
  { versionKey: false },
)

mediaSchema.index({ type: 1, _id: -1 })

export const Media: Model<IMedia> =
  (models.Media as Model<IMedia> | undefined) ?? model<IMedia>('Media', mediaSchema)
