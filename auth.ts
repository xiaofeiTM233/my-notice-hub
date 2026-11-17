// auth.ts
import 'server-only'
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { z } from 'zod'
import {
  LOGIN_RATE_LIMIT,
  LOGIN_RATE_WINDOW_MS,
  SESSION_MAX_AGE_SECONDS,
} from '@/lib/shared/constants'
import { verifyPassword } from '@/lib/server/auth-password'
import { getSetting } from '@/lib/server/setting-store'
import { rateLimit, resetRateLimit } from '@/lib/server/rate-limit'

const credentialsSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt', maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: '/admin/login' },
  providers: [
    Credentials({
      name: '管理员',
      credentials: {
        username: { label: '用户名', type: 'text' },
        password: { label: '密码', type: 'password' },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw)
        if (!parsed.success) return null

        const { username, password } = parsed.data
        const limitKey = `login:${username.toLowerCase()}`
        if (!rateLimit(limitKey, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW_MS)) {
          throw new Error('登录尝试过于频繁，请稍后再试')
        }

        const setting = await getSetting().catch(() => null)
        if (!setting) return null
        if (username !== setting.admin.username) return null
        if (!verifyPassword(password, setting.admin.passwordHash, setting.admin.passwordSalt)) {
          return null
        }

        resetRateLimit(limitKey)
        return {
          id: 'admin',
          name: setting.admin.username,
          username: setting.admin.username,
          sv: setting.admin.sessionVersion,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.username = typeof user.username === 'string' ? user.username : undefined
        token.sv = typeof user.sv === 'number' ? user.sv : undefined
      }
      return token
    },
    session({ session, token }) {
      session.user.username = token.username
      session.sv = token.sv
      return session
    },
  },
})
