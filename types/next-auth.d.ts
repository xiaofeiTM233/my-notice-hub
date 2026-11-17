// types/next-auth.d.ts
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      username?: string
    } & DefaultSession['user']
    sv?: number
  }

  interface User {
    username?: string
    sv?: number
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    username?: string
    sv?: number
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    username?: string
    sv?: number
  }
}
