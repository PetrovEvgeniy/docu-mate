import { Database } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

import type { Message } from "@/lib/types";
import { markdownComponents } from "@/lib/markdownConfig";

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

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
      <div className="relative">
        {isUser ? (
          <div className="absolute top-3 -right-1 w-2.5 h-2.5 bg-indigo-600 rotate-45 z-10" />
        ) : (
          <div className="absolute top-3 -left-1 w-2.5 h-2.5 bg-neutral-800 border-l border-b border-neutral-700 rotate-45 z-10" />
        )}

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
        </div>
      </div>
    </div>
  );
}
