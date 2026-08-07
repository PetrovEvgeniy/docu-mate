import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import GitHub from "next-auth/providers/github"
import type { User } from "@/lib/types"

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true, // Required for Cloud Run deployment
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          // Use internal Docker network URL for server-side calls
          const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
          const res = await fetch(`${apiUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          })

          if (!res.ok) return null

          const data = await res.json()

          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            accessToken: data.access_token,
            totalStorageBytes: data.user.total_storage_bytes,
            storageLimitBytes: data.user.storage_limit_bytes,
          }
        } catch (error) {
          console.error("Auth error:", error)
          return null
        }
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      async profile(profile) {
        // Call backend to create/login OAuth user
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const res = await fetch(`${apiUrl}/auth/oauth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: profile.email,
            name: profile.name,
            oauth_provider: 'google',
            oauth_id: profile.sub,
          }),
        })

        if (!res.ok) {
          throw new Error('OAuth authentication failed')
        }

        const data = await res.json()
        return {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          accessToken: data.access_token,
          totalStorageBytes: data.user.total_storage_bytes,
          storageLimitBytes: data.user.storage_limit_bytes,
        }
      },
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      async profile(profile) {
        // Call backend to create/login OAuth user
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const res = await fetch(`${apiUrl}/auth/oauth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: profile.email,
            name: profile.name || profile.login,
            oauth_provider: 'github',
            oauth_id: profile.id.toString(),
          }),
        })

        if (!res.ok) {
          throw new Error('OAuth authentication failed')
        }

        const data = await res.json()
        return {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          accessToken: data.access_token,
          totalStorageBytes: data.user.total_storage_bytes,
          storageLimitBytes: data.user.storage_limit_bytes,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.accessToken = user.accessToken
        token.id = user.id
        token.totalStorageBytes = user.totalStorageBytes
        token.storageLimitBytes = user.storageLimitBytes
      }

      if (trigger === "update" && token.accessToken) {
        try {
          const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
          const res = await fetch(`${apiUrl}/auth/me`, {
            headers: { Authorization: `Bearer ${token.accessToken}` },
          })
          if (res.ok) {
            const data = await res.json()
            token.totalStorageBytes = data.total_storage_bytes
            token.storageLimitBytes = data.storage_limit_bytes
            console.log('Storage refreshed:', data.total_storage_bytes, 'bytes')
          }
        } catch (error) {
          console.error("Error refreshing storage:", error)
        }
      }

      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.accessToken = token.accessToken as string
        session.user.totalStorageBytes = token.totalStorageBytes as number
        session.user.storageLimitBytes = token.storageLimitBytes as number
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 60, // 30 minutes
  },
})
