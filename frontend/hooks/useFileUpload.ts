"use client";

import { useCallback, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useDropzone } from "react-dropzone";
import { uploadDocument } from "@/services/uploadApi";
import { getDocuments, deleteDocument } from "@/services/documentApi";
import type { UploadedFile } from "@/lib/types";

export function useFileUpload(sessionId?: string | null, onStorageChange?: () => void) {
  const { data: session } = useSession();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);

  // Load documents on mount
  useEffect(() => {
    if (session?.user?.accessToken) {
      loadDocuments();
    } else if (session === null) {
      setUploadedFiles([]);
    }
  }, [session?.user?.accessToken, session]);

  const loadDocuments = async () => {
    if (!session?.user?.accessToken) return;

    setIsLoadingDocuments(true);
    try {
      const docs = await getDocuments(session.user.accessToken);
      setUploadedFiles(docs);
    } catch (error) {
      if (session?.user?.accessToken) {
        console.error("Failed to load documents:", error);
      }
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  const handleDeleteDocument = async (fileId: string) => {
    if (!session?.user?.accessToken) return;

    try {
      await deleteDocument(fileId, session.user.accessToken);
      setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
      setUploadStatus("Document deleted successfully");
      setTimeout(() => setUploadStatus(null), 3000);

      onStorageChange?.();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to delete";
      setUploadStatus(`Error: ${msg}`);
    }
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      if (!session?.user?.accessToken) {
        setUploadStatus("Error: Please log in to upload documents");
        return;
      }

      setIsUploading(true);
      setUploadStatus("Uploading and processing document...");

      try {
        const result = await uploadDocument(
          file,
          sessionId || null,
          session.user.accessToken,
        );
        setUploadedFiles((prev) => [...prev, result.file]);
        setUploadStatus(`Success! Processed ${result.chunksProcessed} chunks.`);

        onStorageChange?.();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setUploadStatus(`Error: ${msg}`);
      } finally {
        setIsUploading(false);
      }
    },
    [session?.user?.accessToken, sessionId],
  );

  const dropzoneProps = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
  });

  return {
    isUploading,
    uploadStatus,
    uploadedFiles,
    isLoadingDocuments,
    dropzoneProps,
    handleDeleteDocument,
  };
}
