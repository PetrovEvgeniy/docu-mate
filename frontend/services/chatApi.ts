import { API_BASE } from "@/lib/constants";

export async function sendChatMessage(
  message: string,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const response = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  if (!response.ok || !response.body) {
    const { detail } = await response
      .json()
      .catch(() => ({ detail: "Chat request failed." }));
    throw new Error(detail ?? "Chat request failed.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    onChunk(chunk);
  }
}
