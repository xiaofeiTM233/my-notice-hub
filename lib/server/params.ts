// lib/server/params.ts
import 'server-only'
import type { NextRequest } from 'next/server'
import { badRequest } from './errors'

export function requireObjectId(value: string): string {
  if (!/^[0-9a-fA-F]{24}$/.test(value)) throw badRequest('ID 格式不正确')
  return value
}

export async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw badRequest('请求体不是合法 JSON')
  }
}

export async function readFormData(request: NextRequest): Promise<FormData> {
  try {
    return await request.formData()
  } catch {
    throw badRequest('请求需要使用 multipart/form-data')
  }
}

export function readFormFile(form: FormData, field = 'file'): File {
  const value = form.get(field)
  if (!(value instanceof File)) throw badRequest('缺少上传文件')
  return value
}
