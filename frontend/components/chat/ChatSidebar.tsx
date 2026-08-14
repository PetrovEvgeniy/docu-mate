"use client"

import { useRef, useEffect } from "react"
import { MessageSquarePlus, Trash2, MessageSquare } from "lucide-react"
import type { ChatSession } from "@/lib/types"

interface ChatSidebarProps {
  sessions: ChatSession[]
  currentSessionId: string | null
  isLoading: boolean
  isOpen: boolean
  onSelectSession: (sessionId: string) => void
  onNewSession: () => void
  onDeleteSession: (sessionId: string) => void
  onClose?: () => void
  onLoadMore: () => void
  hasMore: boolean
}

export function ChatSidebar({
  sessions,
  currentSessionId,
  isLoading,
  isOpen,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onClose,
  onLoadMore,
  hasMore,
}: ChatSidebarProps) {
  const loaderRef = useRef<HTMLDivElement>(null)

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

  // Use IntersectionObserver for lazy loading from backend
  useEffect(() => {
    const loader = loaderRef.current
    if (!loader || !hasMore || isLoading) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(loader)
    return () => observer.disconnect()
  }, [hasMore, onLoadMore, isLoading])

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed md:static top-16 md:top-0 bottom-0 md:inset-y-0 left-0 z-30
          w-64 bg-neutral-900 border border-neutral-800 rounded-2xl flex flex-col overflow-hidden
          transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
        style={{ maxHeight: 'calc(100vh - 150px)' }}
      >
        {/* Header */}
        <div className="p-3 border-b border-neutral-800 shrink-0">
          <button
            onClick={onNewSession}
            className="w-full flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <MessageSquarePlus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        {/* Sessions List */}
        <div
          className="flex-1 overflow-y-auto p-2
          [&::-webkit-scrollbar]:w-1.5
          [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:bg-neutral-600/50
          [&::-webkit-scrollbar-thumb]:rounded-full
          [&::-webkit-scrollbar-thumb:hover]:bg-neutral-500/70"
        >
          {isLoading && sessions.length === 0 ? (
            <div className="flex items-center justify-center p-4 text-neutral-500 text-sm">
              Loading...
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-4 text-neutral-500 text-sm text-center">
              <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
              No chats yet
              <span className="text-xs mt-1">Start a new conversation</span>
            </div>
          ) : (
            <>
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`group relative mb-1 rounded-lg transition-colors ${
                    currentSessionId === session.id
                      ? "bg-neutral-800"
                      : "hover:bg-neutral-800/50"
                  }`}
                >
                  <button
                    onClick={() => {
                      onSelectSession(session.id)
                      onClose?.()
                    }}
                    className="w-full text-left p-2.5 pr-9"
                  >
                    <div className="text-sm truncate mb-0.5 text-neutral-200">
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
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 rounded transition-all"
                    title="Delete session"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              ))}

              {/* Intersection observer target */}
              {(hasMore || isLoading) && (
                <div ref={loaderRef} className="text-center py-3 text-xs text-neutral-400">
                  Loading more...
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
