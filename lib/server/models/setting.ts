// lib/server/models/setting.ts
import { Schema, model, models, type Model } from 'mongoose'
import {
  AUTO_IMPORT_DEFAULT_LIMIT,
  MEDIA_TYPES,
  type MediaType,
} from '@/lib/shared/constants'

export interface SettingAdmin {
  username: string
  passwordHash: string
  passwordSalt: string
  passwordUpdatedAt: number
  sessionVersion: number
}

export interface SettingMedia {
  type: MediaType
  maxUploadSize: number
  allowedFormats: string[]
  vercelToken?: string
  r2AccessKeyId?: string
  r2SecretAccessKey?: string
  r2Endpoint?: string
  r2Bucket?: string
  r2PublicUrl?: string
  webdavUrl?: string
  webdavUser?: string
  webdavPass?: string
  webdavBasePath?: string
  edgeoneToken?: string
  edgeoneProjectId?: string
  edgeoneStoreName?: string
}

export interface SettingAutoImport {
  enabled: boolean
  adapters: string[]
  limit: number
  duplicate: 'skip' | 'overwrite'
  // 运行锁时间戳，避免定时任务与手动运行并发写入
  lockAt?: number
}

export interface ISetting {
  _id: string
  admin: SettingAdmin
  media: SettingMedia
  autoImport: SettingAutoImport
}

const adminSchema = new Schema<SettingAdmin>(
  {
    username: { type: String, required: true, default: 'admin' },
    passwordHash: { type: String, required: true },
    passwordSalt: { type: String, required: true },
    passwordUpdatedAt: { type: Number, required: true, default: 0 },
    sessionVersion: { type: Number, required: true, default: 0 },
  },
  { _id: false },
)

const mediaSchema = new Schema<SettingMedia>(
  {
    type: { type: String, enum: MEDIA_TYPES, required: true, default: 'base64' },
    maxUploadSize: { type: Number, required: true, default: 4 * 1024 * 1024 },
    allowedFormats: { type: [String], default: [] },
    vercelToken: { type: String },
    r2AccessKeyId: { type: String },
    r2SecretAccessKey: { type: String },
    r2Endpoint: { type: String },
    r2Bucket: { type: String },
    r2PublicUrl: { type: String },
    webdavUrl: { type: String },
    webdavUser: { type: String },
    webdavPass: { type: String },
    webdavBasePath: { type: String },
    edgeoneToken: { type: String },
    edgeoneProjectId: { type: String },
    edgeoneStoreName: { type: String },
  },
  { _id: false },
)

const autoImportSchema = new Schema<SettingAutoImport>(
  {
    enabled: { type: Boolean, required: true, default: false },
    adapters: { type: [String], default: [] },
    limit: { type: Number, required: true, default: AUTO_IMPORT_DEFAULT_LIMIT },
    duplicate: { type: String, enum: ['skip', 'overwrite'], required: true, default: 'skip' },
    lockAt: { type: Number },
  },
  { _id: false },
)

const settingSchema = new Schema<ISetting>(
  {
    _id: { type: String, default: 'singleton' },
    admin: { type: adminSchema, required: true },
    media: { type: mediaSchema, required: true },
    autoImport: { type: autoImportSchema, required: true, default: () => ({}) },
  },
  { versionKey: false },
)

export const Setting: Model<ISetting> =
  (models.Setting as Model<ISetting> | undefined) ?? model<ISetting>('Setting', settingSchema)
