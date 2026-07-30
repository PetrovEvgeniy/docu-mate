import { auth } from "@/auth"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export async function authFetch(url: string, options: RequestInit = {}) {
  const session = await auth()

  return fetch(`${API_URL}${url}`, {
    ...options,
    headers: {
      ...options.headers,
      ...(session?.user?.accessToken && {
        Authorization: `Bearer ${session.user.accessToken}`,
      }),
    },
  })
}
