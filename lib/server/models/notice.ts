// lib/server/models/notice.ts
import { Schema, model, models, type Model, type Types } from 'mongoose'
import { NOTICE_PRIORITIES, type NoticePriority } from '@/lib/shared/constants'

export interface NoticeLogEntry {
  id?: string
  timestamp: number
  body?: string
}

export interface NoticeAuthor {
  name?: string
  avatar?: string
}

export interface NoticeMeta {
  type: 'article'
  channel: string
  priority: NoticePriority
  timestamp: number
}

export interface NoticeContent {
  title: string
  summary?: string
  body?: string
  author?: NoticeAuthor
  cover?: string
  tags: string[]
  entities: string[]
}

export interface NoticeInteraction {
  views: NoticeLogEntry[]
  likes: NoticeLogEntry[]
  comments: NoticeLogEntry[]
}

export interface INotice {
  _id: Types.ObjectId
  meta: NoticeMeta
  content: NoticeContent
  interaction: NoticeInteraction
  extra?: Record<string, unknown>
}

const logSchema = new Schema<NoticeLogEntry>(
  {
    id: { type: String },
    timestamp: { type: Number, required: true },
    body: { type: String },
  },
  { _id: false },
)

const authorSchema = new Schema<NoticeAuthor>(
  {
    name: { type: String, trim: true },
    avatar: { type: String, trim: true },
  },
  { _id: false },
)

const metaSchema = new Schema<NoticeMeta>(
  {
    type: { type: String, enum: ['article'], default: 'article', required: true },
    channel: { type: String, required: true, trim: true },
    priority: { type: String, enum: NOTICE_PRIORITIES, default: 'normal', required: true },
    timestamp: { type: Number, required: true },
  },
  { _id: false },
)

const contentSchema = new Schema<NoticeContent>(
  {
    title: { type: String, required: true, trim: true },
    summary: { type: String, default: '' },
    body: { type: String, default: '' },
    author: { type: authorSchema, default: undefined },
    cover: { type: String, default: '' },
    tags: { type: [String], default: [] },
    entities: { type: [String], default: [] },
  },
  { _id: false },
)

const interactionSchema = new Schema<NoticeInteraction>(
  {
    views: { type: [logSchema], default: [] },
    likes: { type: [logSchema], default: [] },
    comments: { type: [logSchema], default: [] },
  },
  { _id: false },
)

const noticeSchema = new Schema<INotice>(
  {
    meta: { type: metaSchema, required: true },
    content: { type: contentSchema, required: true },
    interaction: { type: interactionSchema, required: true },
    extra: { type: Schema.Types.Mixed, default: undefined },
  },
  { versionKey: false, minimize: false },
)

noticeSchema.index({ 'meta.timestamp': -1 })
noticeSchema.index({ 'meta.channel': 1, 'meta.timestamp': -1 })
noticeSchema.index({ 'meta.priority': 1, 'meta.timestamp': -1 })
noticeSchema.index({ 'content.tags': 1, 'meta.timestamp': -1 })

export const Notice: Model<INotice> =
  (models.Notice as Model<INotice> | undefined) ?? model<INotice>('Notice', noticeSchema)
