"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, FileText } from "lucide-react";

import type { Message, UploadedFile } from "@/lib/types";
import { API_BASE, TABS } from "@/lib/constants";
import { statusClasses, getStatusVariant } from "@/lib/uploadStatus";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { EmptyChatState } from "@/components/chat/EmptyChatState";

export default function Home() {
  // ── Navigation ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"chat" | "data">("data");

  // ── Chat state ──────────────────────────────────────────────────────────────
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // ── Upload state ─────────────────────────────────────────────────────────────
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async (e: SubmitEvent) => {
    e.preventDefault();
    if (!input.trim() || isChatLoading) return;

    const userMessage: Message = { id: Date.now().toString(), role: "user", content: input };
    const assistantId = String(Date.now() + 1);

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsChatLoading(true);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage.content }),
      });

      if (!response.ok || !response.body) {
        const { detail } = await response.json().catch(() => ({ detail: "Chat request failed." }));
        throw new Error(detail ?? "Chat request failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let isFirstChunk = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });

        if (isFirstChunk) {
          // Add the assistant bubble on the first chunk (no empty bubble during loading)
          setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: chunk }]);
          isFirstChunk = false;
        } else {
          setMessages(prev =>
            prev.map(m => m.id === assistantId ? { ...m, content: m.content + chunk } : m)
          );
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: `Error: ${msg}` }]);
    } finally {
      setIsChatLoading(false);
    }
  }, [input, isChatLoading]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file?.name.endsWith(".pdf")) {
      setUploadStatus("Error: Only PDF files are supported.");
      return;
    }

    setIsUploading(true);
    setUploadStatus("Uploading and processing document...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_BASE}/upload`, { method: "POST", body: formData });

      if (!response.ok) {
        const { detail } = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(detail ?? `Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      setUploadedFiles(prev => [...prev, { name: data.filename, id: data.file_id }]);
      setUploadStatus(`Success! Processed ${data.chunks_processed} chunks.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setUploadStatus(`Error: ${msg}`);
    } finally {
      setIsUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
  });

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 font-sans flex flex-col">

      {/* Header */}
      <header className="border-b border-neutral-800 p-6 flex justify-between items-center bg-neutral-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <img src="/favicon.png" alt="DocuMate logo" className="w-10 h-10 rounded-xl object-cover shadow-lg shadow-indigo-500/20" />
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
            DocuMate
          </h1>
        </div>

        <nav className="flex p-1 bg-neutral-900 rounded-lg border border-neutral-800">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                activeTab === id
                  ? "bg-neutral-800 text-white shadow-sm"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-800/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-6 flex flex-col">

        {activeTab === "data" ? (

          /* ── Data Sources Tab ── */
          <div className="flex-1 flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h2 className="text-3xl font-light mb-2">Knowledge Base</h2>
              <p className="text-neutral-400">Upload PDF documents to expand the AI&apos;s knowledge.</p>
            </div>

            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center min-h-[300px] ${
                isDragActive
                  ? "border-indigo-500 bg-indigo-500/10 scale-[1.02]"
                  : isUploading
                    ? "border-neutral-800 bg-neutral-900/50 cursor-not-allowed"
                    : "border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900"
              }`}
            >
              <input {...getInputProps()} disabled={isUploading} />
              {isUploading ? (
                <div className="flex flex-col items-center gap-4 text-indigo-400">
                  <svg className="w-12 h-12 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <p className="font-medium animate-pulse">Analyzing and embedding document...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 text-neutral-400">
                  <div className="w-20 h-20 bg-neutral-900 rounded-full flex items-center justify-center mb-2 shadow-inner">
                    <UploadCloud className={`w-10 h-10 ${isDragActive ? "text-indigo-400" : "text-neutral-500"}`} />
                  </div>
                  <p className="text-xl font-medium text-neutral-200">
                    {isDragActive ? "Drop your PDF here..." : "Drag & drop a PDF, or click to select"}
                  </p>
                  <p className="text-sm">Supported formats: .pdf (Max 10MB)</p>
                </div>
              )}
            </div>

            {/* Upload status banner */}
            {uploadStatus && (
              <div className={`p-4 rounded-xl border flex items-center gap-3 ${statusClasses[getStatusVariant(uploadStatus)]}`}>
                {getStatusVariant(uploadStatus) === "success" && <FileText className="w-5 h-5" />}
                <p>{uploadStatus}</p>
              </div>
            )}

            {/* Processed file list */}
            {uploadedFiles.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-medium mb-4 text-neutral-300">Processed Documents</h3>
                <div className="grid gap-3">
                  {uploadedFiles.map(file => (
                    <div
                      key={file.id}
                      className="flex items-center gap-4 p-4 rounded-xl border border-neutral-800 bg-neutral-900/50 group hover:border-neutral-700 transition-colors"
                    >
                      <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400 group-hover:bg-indigo-500/30 transition-colors">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-neutral-200">{file.name}</p>
                        <p className="text-xs text-neutral-500 font-mono mt-1">ID: {file.id}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        ) : (

          /* ── Chat Tab ── */
          <div className="flex-1 flex flex-col bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl shadow-black/50 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              {messages.length === 0 ? (
                <EmptyChatState />
              ) : (
                messages.map(m => <MessageBubble key={m.id} message={m} />)
              )}
              {isChatLoading && <TypingIndicator />}
            </div>

            {/* Input */}
            <div className="p-4 bg-neutral-950/50 border-t border-neutral-800">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Ask a question about your documents..."
                  className="flex-1 bg-neutral-900 border border-neutral-700 rounded-xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-neutral-200 placeholder:text-neutral-500"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isChatLoading}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20"
                >
                  Send
                </button>
              </form>
            </div>
          </div>

        )}
      </main>
    </div>
  );
}
