import { API_BASE } from "@/lib/constants";

export async function sendChatMessage(
  message: string,
  onChunk: (chunk: string) => void,
  sessionId?: string | null,
  accessToken?: string,
): Promise<string | null> {
  const response = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    },
    body: JSON.stringify({
      message,
      ...(sessionId && { session_id: sessionId }),
    }),
  });

  if (!response.ok || !response.body) {
    const { detail } = await response
      .json()
      .catch(() => ({ detail: "Chat request failed." }));
    throw new Error(detail ?? "Chat request failed.");
  }

  // Extract session ID from response header
  const newSessionId = response.headers.get("X-Session-Id");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    onChunk(chunk);
  }

  return newSessionId;
}
