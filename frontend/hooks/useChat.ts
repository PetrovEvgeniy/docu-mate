"use client";

import { useState, useCallback, type SubmitEvent as ReactSubmitEvent } from "react";
import { sendChatMessage } from "@/services/chatApi";
import type { Message } from "@/lib/types";

export function useChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: ReactSubmitEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!input.trim() || isChatLoading) return;

      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: input,
      };
      const assistantId = String(Date.now() + 1);

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsChatLoading(true);

      try {
        let isFirstChunk = true;
        await sendChatMessage(userMessage.content, (chunk) => {
          if (isFirstChunk) {
            setMessages((prev) => [
              ...prev,
              { id: assistantId, role: "assistant", content: chunk },
            ]);
            isFirstChunk = false;
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + chunk }
                  : m,
              ),
            );
          }
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: `Error: ${msg}` },
        ]);
      } finally {
        setIsChatLoading(false);
      }
    },
    [input, isChatLoading],
  );

  return { input, setInput, messages, isChatLoading, handleSubmit };
}
