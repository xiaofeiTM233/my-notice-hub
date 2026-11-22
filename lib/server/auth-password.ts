// lib/server/auth-password.ts
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const KEY_LENGTH = 64
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }

export interface PasswordDigest {
  hash: string
  salt: string
}

export function hashPassword(password: string): PasswordDigest {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS).toString('hex')
  return { hash, salt }
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const expected = Buffer.from(hash, 'hex')
  const actual = scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS)
  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}
