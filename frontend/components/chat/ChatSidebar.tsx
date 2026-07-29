"use client"

import { MessageSquarePlus, Trash2, MessageSquare } from "lucide-react"
import type { ChatSession } from "@/lib/types"

interface ChatSidebarProps {
  sessions: ChatSession[]
  currentSessionId: string | null
  isLoading: boolean
  onSelectSession: (sessionId: string) => void
  onNewSession: () => void
  onDeleteSession: (sessionId: string) => void
}

export function ChatSidebar({
  sessions,
  currentSessionId,
  isLoading,
  onSelectSession,
  onNewSession,
  onDeleteSession,
}: ChatSidebarProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="w-64 bg-neutral-900 border-r border-neutral-800 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-neutral-800">
        <button
          onClick={onNewSession}
          className="w-full flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
        >
          <MessageSquarePlus className="w-5 h-5" />
          New Chat
        </button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center p-4 text-neutral-500">
            Loading...
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-4 text-neutral-500 text-sm text-center">
            <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
            No chats yet
            <span className="text-xs mt-1">Start a new conversation</span>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={`group relative mb-1 rounded-lg transition-colors ${
                currentSessionId === session.id
                  ? "bg-neutral-800"
                  : "hover:bg-neutral-800/50"
              }`}
            >
              <button
                onClick={() => onSelectSession(session.id)}
                className="w-full text-left p-3 pr-10"
              >
                <div className="font-medium text-sm truncate mb-1">
                  {session.title || "New Chat"}
                </div>
                <div className="text-xs text-neutral-500">
                  {formatDate(session.updated_at)}
                </div>
              </button>

              {/* Delete button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm("Delete this chat session?")) {
                    onDeleteSession(session.id)
                  }
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 rounded transition-all"
                title="Delete session"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
