"use client";

import { useState, useCallback, useEffect, type SubmitEvent as ReactSubmitEvent } from "react";
import { useSession } from "next-auth/react";
import { sendChatMessage } from "@/services/chatApi";
import { getChatSessions, getSessionMessages, deleteSession } from "@/services/chatSessionApi";
import type { Message, ChatSession } from "@/lib/types";

export function useChat() {
  const { data: session } = useSession();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  // Load user's chat sessions
  const loadSessions = useCallback(async () => {
    if (!session?.user?.accessToken) return;

    setIsLoadingSessions(true);
    try {
      const userSessions = await getChatSessions(session.user.accessToken);
      setSessions(userSessions);
    } catch (error) {
      console.error("Failed to load sessions:", error);
    } finally {
      setIsLoadingSessions(false);
    }
  }, [session?.user?.accessToken]);

  // Load messages for a specific session
  const loadSession = useCallback(async (sessionId: string) => {
    if (!session?.user?.accessToken) return;

    setIsChatLoading(true);
    try {
      const sessionMessages = await getSessionMessages(sessionId, session.user.accessToken);
      setMessages(sessionMessages);
      setCurrentSessionId(sessionId);
    } catch (error) {
      console.error("Failed to load session:", error);
    } finally {
      setIsChatLoading(false);
    }
  }, [session?.user?.accessToken]);

  // Create new session (clear chat)
  const createNewSession = useCallback(() => {
    setMessages([]);
    setCurrentSessionId(null);
    setInput("");
  }, []);

  // Delete a session
  const handleDeleteSession = useCallback(async (sessionId: string) => {
    if (!session?.user?.accessToken) return;

    try {
      await deleteSession(sessionId, session.user.accessToken);

      // If deleting current session, clear it
      if (sessionId === currentSessionId) {
        createNewSession();
      }

      // Reload sessions list
      await loadSessions();
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  }, [session?.user?.accessToken, currentSessionId, createNewSession, loadSessions]);

  // Load sessions on mount
  useEffect(() => {
    if (session?.user?.accessToken) {
      loadSessions();
    }
  }, [session?.user?.accessToken, loadSessions]);

  const handleSubmit = useCallback(
    async (e: ReactSubmitEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!input.trim() || isChatLoading || !session?.user?.accessToken) return;

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
        await sendChatMessage(
          userMessage.content,
          (chunk) => {
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
          },
          currentSessionId,
          session.user.accessToken,
        );

        // Reload sessions to get the updated list (new session might have been created)
        await loadSessions();
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
    [input, isChatLoading, session?.user?.accessToken, currentSessionId, loadSessions],
  );

  return {
    input,
    setInput,
    messages,
    isChatLoading,
    handleSubmit,
    sessions,
    isLoadingSessions,
    currentSessionId,
    loadSession,
    createNewSession,
    handleDeleteSession,
  };
}
