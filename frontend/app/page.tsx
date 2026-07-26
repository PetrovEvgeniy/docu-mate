"use client";

import { useState, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, MessageSquare, Database, FileText, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<"chat" | "data">("data");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isChatLoading) return;

    const userMessage: Message = { id: Date.now().toString(), role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsChatLoading(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const response = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage.content }),
      });

      if (!response.ok || !response.body) {
        const errData = await response.json().catch(() => ({ detail: "Chat request failed." }));
        throw new Error(errData.detail || "Chat request failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, content: m.content + chunk } : m)
        );
      }
    } catch (err: any) {
      setMessages(prev =>
        prev.map(m => m.id === assistantId ? { ...m, content: `Error: ${err.message}` } : m)
      );
    } finally {
      setIsChatLoading(false);
    }
  };

  // Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<{name: string, id: string}[]>([]);

  // Dropzone setup
  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file || !file.name.endsWith(".pdf")) {
      setUploadStatus("Error: Only PDF files are supported.");
      return;
    }

    setIsUploading(true);
    setUploadStatus("Uploading and processing document...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://localhost:8000/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(errorData.detail || `Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      setUploadedFiles(prev => [...prev, { name: data.filename, id: data.file_id }]);
      setUploadStatus(`Success! Processed ${data.chunks_processed} chunks.`);
    } catch (error: any) {
      setUploadStatus(`Error: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: {'application/pdf': ['.pdf']} });

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 font-sans flex flex-col">
      {/* Header */}
      <header className="border-b border-neutral-800 p-6 flex justify-between items-center bg-neutral-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Database className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
            DocuMate
          </h1>
        </div>
        
        {/* Tabs */}
        <div className="flex p-1 bg-neutral-900 rounded-lg border border-neutral-800">
          <button
            onClick={() => setActiveTab("data")}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
              activeTab === "data" ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-400 hover:text-white hover:bg-neutral-800/50"
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            Data Sources
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
              activeTab === "chat" ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-400 hover:text-white hover:bg-neutral-800/50"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Chat
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 flex flex-col">
        {activeTab === "data" ? (
          <div className="flex-1 flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h2 className="text-3xl font-light mb-2">Knowledge Base</h2>
              <p className="text-neutral-400">Upload PDF documents to expand the AI's knowledge.</p>
            </div>
            
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
                  <Loader2 className="w-12 h-12 animate-spin" />
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

            {uploadStatus && (
              <div className={`p-4 rounded-xl border flex items-center gap-3 ${
                uploadStatus.startsWith("Error") ? "bg-red-500/10 border-red-500/20 text-red-400" :
                uploadStatus.startsWith("Success") ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
              }`}>
                {uploadStatus.startsWith("Success") && <FileText className="w-5 h-5" />}
                <p>{uploadStatus}</p>
              </div>
            )}

            {uploadedFiles.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-medium mb-4 text-neutral-300">Processed Documents</h3>
                <div className="grid gap-3">
                  {uploadedFiles.map((file, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-neutral-800 bg-neutral-900/50 group hover:border-neutral-700 transition-colors">
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
          <div className="flex-1 flex flex-col bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl shadow-black/50 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Chat Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              {messages.length === 0 ? (
                <div className="m-auto text-center flex flex-col items-center gap-4 text-neutral-500">
                  <div className="w-16 h-16 bg-neutral-800 rounded-2xl flex items-center justify-center rotate-3 shadow-lg">
                    <MessageSquare className="w-8 h-8 text-indigo-500" />
                  </div>
                  <h3 className="text-xl font-medium text-neutral-300">Ask DocuMate</h3>
                  <p className="max-w-xs">Ask questions about the documents you've uploaded to the knowledge base.</p>
                </div>
              ) : (
                messages.map(m => (
                  <div key={m.id} className={`flex gap-4 max-w-[80%] ${m.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                      m.role === 'user' ? 'bg-indigo-600' : 'bg-neutral-700'
                    }`}>
                      {m.role === 'user' ? (
                        <div className="w-3 h-3 bg-white rounded-full opacity-80" />
                      ) : (
                        <Database className="w-4 h-4 text-neutral-300" />
                      )}
                    </div>
                    <div className={`px-5 py-3 rounded-2xl shadow-sm leading-relaxed ${
                      m.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-tr-sm' 
                        : 'bg-neutral-800 text-neutral-200 rounded-tl-sm border border-neutral-700'
                    }`}>
                      {m.role === 'user' ? (
                        m.content
                      ) : (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeHighlight]}
                          components={{
                            h1: ({node, ...props}) => <h1 className="text-xl font-bold mt-4 mb-2 text-neutral-100" {...props} />,
                            h2: ({node, ...props}) => <h2 className="text-lg font-semibold mt-3 mb-2 text-neutral-100" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-base font-semibold mt-2 mb-1 text-neutral-200" {...props} />,
                            p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc list-inside mb-2 space-y-1 pl-2" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-2 space-y-1 pl-2" {...props} />,
                            li: ({node, ...props}) => <li className="text-neutral-300" {...props} />,
                            strong: ({node, ...props}) => <strong className="font-semibold text-neutral-100" {...props} />,
                            em: ({node, ...props}) => <em className="italic text-neutral-300" {...props} />,
                            code: ({node, inline, ...props}: any) =>
                              inline
                                ? <code className="bg-neutral-900 text-indigo-300 px-1.5 py-0.5 rounded text-sm font-mono" {...props} />
                                : <code {...props} />,
                            pre: ({node, ...props}) => <pre className="bg-neutral-900 rounded-xl p-4 my-2 overflow-x-auto text-sm" {...props} />,
                            blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-indigo-500 pl-4 my-2 text-neutral-400 italic" {...props} />,
                            table: ({node, ...props}) => <div className="overflow-x-auto my-2"><table className="min-w-full text-sm border-collapse" {...props} /></div>,
                            th: ({node, ...props}) => <th className="border border-neutral-600 px-3 py-1.5 bg-neutral-900 text-left font-semibold text-neutral-200" {...props} />,
                            td: ({node, ...props}) => <td className="border border-neutral-700 px-3 py-1.5 text-neutral-300" {...props} />,
                            a: ({node, ...props}) => <a className="text-indigo-400 underline hover:text-indigo-300" target="_blank" rel="noopener noreferrer" {...props} />,
                            hr: ({node, ...props}) => <hr className="border-neutral-700 my-3" {...props} />,
                          }}
                        >
                          {m.content}
                        </ReactMarkdown>
                      )}
                    </div>
                  </div>
                ))
              )}
              {isChatLoading && (
                 <div className="flex gap-4 max-w-[80%] self-start">
                  <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center shrink-0">
                    <Loader2 className="w-4 h-4 text-neutral-400 animate-spin" />
                  </div>
                  <div className="px-5 py-3 rounded-2xl bg-neutral-800 text-neutral-400 rounded-tl-sm border border-neutral-700">
                    Thinking...
                  </div>
                 </div>
              )}
            </div>
            
            {/* Input Area */}
            <div className="p-4 bg-neutral-950/50 border-t border-neutral-800">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  value={input}
                  onChange={handleInputChange}
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
