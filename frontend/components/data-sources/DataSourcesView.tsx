"use client";

import { FileText, UploadCloud, Trash2 } from "lucide-react";
import { statusClasses, getStatusVariant } from "@/lib/constants";
import { useFileUpload } from "@/hooks/useFileUpload";
import { useStorage } from "@/contexts/StorageContext";

export function DataSourcesView() {
  const { refreshStorage } = useStorage();
  const { isUploading, uploadStatus, uploadedFiles, isLoadingDocuments, dropzoneProps, handleDeleteDocument } =
    useFileUpload(null, refreshStorage);

  const { getRootProps, getInputProps, isDragActive } = dropzoneProps;

  return (
    <div className="flex-1 flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-light mb-2">Knowledge Base</h2>
        <p className="text-neutral-400">
          Upload PDF documents to your knowledge base. They will be available in all chat sessions.
        </p>
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
              <UploadCloud
                className={`w-10 h-10 ${isDragActive ? "text-indigo-400" : "text-neutral-500"}`}
              />
            </div>
            <p className="text-xl font-medium text-neutral-200">
              {isDragActive
                ? "Drop your PDF here..."
                : "Drag & drop a PDF, or click to select"}
            </p>
            <p className="text-sm">Supported formats: .pdf (Max 10MB)</p>
          </div>
        )}
      </div>

      {/* Upload status banner */}
      {uploadStatus && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 ${statusClasses[getStatusVariant(uploadStatus)]}`}
        >
          {getStatusVariant(uploadStatus) === "success" && (
            <FileText className="w-5 h-5" />
          )}
          <p>{uploadStatus}</p>
        </div>
      )}

      {/* Processed file list */}
      {isLoadingDocuments ? (
        <div className="text-center text-neutral-500 py-8">Loading documents...</div>
      ) : uploadedFiles.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-lg font-medium mb-4 text-neutral-300">
            Your Documents ({uploadedFiles.length})
          </h3>
          <div className="grid gap-3 max-h-64 overflow-y-auto pr-2
            [&::-webkit-scrollbar]:w-1.5
            [&::-webkit-scrollbar-track]:bg-neutral-800/30
            [&::-webkit-scrollbar-thumb]:bg-neutral-600
            [&::-webkit-scrollbar-thumb]:rounded-full
            [&::-webkit-scrollbar-thumb:hover]:bg-neutral-500">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-4 p-4 rounded-xl border border-neutral-800 bg-neutral-900/50 group hover:border-neutral-700 transition-colors"
              >
                <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400 group-hover:bg-indigo-500/30 transition-colors">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-neutral-200">{file.name}</p>
                  <p className="text-xs text-neutral-500 font-mono mt-1">
                    {file.file_size_bytes
                      ? `${(file.file_size_bytes / 1024).toFixed(2)} KB`
                      : `ID: ${file.id}`}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${file.name}"?`)) {
                      handleDeleteDocument(file.id);
                    }
                  }}
                  className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 rounded transition-all"
                  title="Delete document"
                >
                  <Trash2 className="w-5 h-5 text-red-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center text-neutral-500 py-8">
          No documents uploaded yet. Upload your first PDF to get started.
        </div>
      )}
    </div>
  );
}
