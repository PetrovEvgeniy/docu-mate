"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { EmptyChatState } from "@/components/chat/EmptyChatState";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { useChat } from "@/hooks/useChat";

export function ChatView() {
  const {
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
  } = useChat();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const handleViewportChange = () => setIsSmallScreen(mediaQuery.matches);

    handleViewportChange();

    mediaQuery.addEventListener("change", handleViewportChange);
    return () => mediaQuery.removeEventListener("change", handleViewportChange);
  }, []);

  const inputPlaceholder = isSmallScreen
    ? "Ask about your docs..."
    : "Ask a question about your documents...";

  return (
    <div className="flex-1 flex gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Sidebar */}
      <ChatSidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        isLoading={isLoadingSessions}
        isOpen={isSidebarOpen}
        onSelectSession={loadSession}
        onNewSession={createNewSession}
        onDeleteSession={handleDeleteSession}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Chat */}
      <div className="flex-1 flex flex-col bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl shadow-black/50">
        {/* Mobile header bar with sidebar toggle */}
        <div className="md:hidden flex items-center gap-2 px-4 py-3 border-b border-neutral-800 shrink-0">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-neutral-800 transition-colors"
            aria-label="Open chat history"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm text-neutral-400">Chat History</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {messages.length === 0 ? (
            <EmptyChatState />
          ) : (
            messages.map((m) => <MessageBubble key={m.id} message={m} />)
          )}
          {isChatLoading && <TypingIndicator />}
        </div>

        {/* Input */}
        <div className="p-4 bg-neutral-950/50 border-t border-neutral-800 shrink-0">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={inputPlaceholder}
              className="flex-1 bg-neutral-900 border border-neutral-700 rounded-xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-neutral-200 placeholder:text-neutral-500"
            />
            <button
              type="submit"
              disabled={!input.trim() || isChatLoading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 sm:px-6 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20 whitespace-nowrap shrink-0"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
