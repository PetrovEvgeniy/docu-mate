import { API_BASE } from "@/lib/constants"
import type { ChatSession, Message } from "@/lib/types"

export interface SessionsResponse {
  sessions: ChatSession[]
  total: number
  skip: number
  limit: number
}

export async function getChatSessions(
  accessToken: string,
  skip: number = 0,
  limit: number = 5
): Promise<SessionsResponse> {
  const response = await fetch(`${API_BASE}/chat/sessions?skip=${skip}&limit=${limit}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error("Failed to fetch chat sessions")
  }

  return response.json()
}

export async function getSessionMessages(
  sessionId: string,
  accessToken: string,
): Promise<Message[]> {
  const response = await fetch(`${API_BASE}/chat/sessions/${sessionId}/messages`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error("Failed to fetch session messages")
  }

  return response.json()
}

export async function deleteSession(
  sessionId: string,
  accessToken: string,
): Promise<void> {
  const response = await fetch(`${API_BASE}/chat/sessions/${sessionId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error("Failed to delete session")
  }
}
