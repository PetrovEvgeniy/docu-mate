import { API_BASE } from "@/lib/constants";
import type { Source } from "@/lib/types";

export async function sendChatMessage(
  message: string,
  onChunk: (chunk: string) => void,
  onSources: (sources: Source[]) => void,
  sessionId?: string | null,
  accessToken?: string,
): Promise<string | null> {
  try {
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
      let detail = "Chat request failed.";
      try {
        const errorData = await response.json();
        detail = errorData.detail || detail;
      } catch {
        detail = "Chat request failed.";
      }
      throw new Error(detail);
    }

    // Extract session ID and sources from response headers
    const newSessionId = response.headers.get("X-Session-Id");
    const sourcesHeader = response.headers.get("X-Sources");

    // Parse sources from base64-encoded header
    if (sourcesHeader) {
      try {
        const decodedSources = atob(sourcesHeader);
        const sources = JSON.parse(decodedSources) as Source[];
        onSources(sources);
      } catch {
        onSources([]);
      }
    } else {
      onSources([]);
    }

    // Stream the response content
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      onChunk(chunk);
    }

    return newSessionId;
  } catch (error) {
    throw error instanceof Error ? error : new Error("Network error");
  }
}
