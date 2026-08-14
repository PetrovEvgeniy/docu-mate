import { Database, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

import type { Message } from "@/lib/types";
import { markdownComponents } from "@/lib/markdownConfig";

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const [showSources, setShowSources] = useState(false);

  return (
    <div className={`flex gap-4 max-w-[80%] ${isUser ? "self-end flex-row-reverse" : "self-start"}`}>

      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm overflow-hidden ${
        isUser ? "ring-1 ring-white/70" : "bg-neutral-700"
      }`}>
        {isUser ? (
          <img src="/user-avatar.png" alt="User" className="w-full h-full object-cover [clip-path:circle(50%)]" />
        ) : (
          <Database className="w-4 h-4 text-neutral-300" />
        )}
      </div>

      {/* Bubble with tail pointer */}
      <div className="relative flex flex-col gap-2 flex-1 min-w-0">
        {isUser ? (
          <div className="absolute top-3 -right-1 w-2.5 h-2.5 bg-indigo-600 rotate-45 z-10" />
        ) : (
          <div className="absolute top-3 -left-1 w-2.5 h-2.5 bg-neutral-800 border-l border-b border-neutral-700 rotate-45 z-10" />
        )}

        {/* Main message content */}
        <div className={`px-5 py-3 rounded-2xl shadow-sm leading-relaxed ${
          isUser
            ? "bg-indigo-600 text-white rounded-tr-none"
            : "bg-neutral-800 text-neutral-200 rounded-tl-none border border-neutral-700"
        }`}>
          {isUser ? (
            message.content
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={markdownComponents}
            >
              {message.content}
            </ReactMarkdown>
          )}

          {/* Sources section integrated into bubble - only for assistant messages */}
          {!isUser && message.sources && message.sources.length > 0 && (
            <div className="mt-4 pt-3 border-t border-neutral-700/50">
              {/* Toggle button */}
              <button
                onClick={() => setShowSources(!showSources)}
                className="flex items-center gap-2 text-xs text-neutral-400 hover:text-neutral-300 transition-colors w-full"
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="font-medium">Sources ({message.sources.length})</span>
                {showSources ? (
                  <ChevronUp className="w-3.5 h-3.5 ml-auto" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 ml-auto" />
                )}
              </button>

              {/* Sources list */}
              {showSources && (
                <div className="mt-2 space-y-1.5">
                  {message.sources.map((source, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 text-xs text-neutral-400 py-1"
                    >
                      <div className="w-1 h-1 rounded-full bg-neutral-600 shrink-0" />
                      <span className="flex-1 min-w-0 truncate" title={source.filename}>
                        {source.filename}
                      </span>
                      <span className="text-neutral-500 shrink-0">p.{source.page}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
