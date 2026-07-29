import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      accessToken: string
      totalStorageBytes: number
      storageLimitBytes: number
    } & DefaultSession["user"]
  }

  interface User {
    accessToken?: string
    totalStorageBytes?: number
    storageLimitBytes?: number
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string
    totalStorageBytes?: number
    storageLimitBytes?: number
  }
}
