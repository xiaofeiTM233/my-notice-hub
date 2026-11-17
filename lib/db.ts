// lib/db.ts
import mongoose, { type ConnectOptions } from 'mongoose'

interface MongooseCache {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  var mongooseCache: MongooseCache | undefined
}

const opts: ConnectOptions = {
  bufferCommands: false,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
}

// URI 未指定数据库名时补默认库名；mongodb+srv 解析失败则交给驱动处理。
try {
  const uri = process.env.MONGODB_URI
  if (uri) {
    const parsed = new URL(uri)
    if (!parsed.pathname || parsed.pathname === '/') {
      opts.dbName = 'notice'
    }
  }
} catch {
  // 保持默认连接串，不阻断启动。
}

const cached: MongooseCache = global.mongooseCache ?? { conn: null, promise: null }
global.mongooseCache = cached

// 建立或复用全局连接，开发热重载不会重复建连。
async function dbConnect(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('请在 .env 或 .env.local 中定义 MONGODB_URI 环境变量')
  }

  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, opts)
  }

  try {
    cached.conn = await cached.promise
  } catch {
    cached.promise = null
    throw new Error('数据库连接失败')
  }

  return cached.conn
}

export default dbConnect