"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { uploadDocument } from "@/services/uploadApi";
import type { UploadedFile } from "@/lib/types";

export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus("Uploading and processing document...");

    try {
      const result = await uploadDocument(file);
      setUploadedFiles((prev) => [...prev, result.file]);
      setUploadStatus(`Success! Processed ${result.chunksProcessed} chunks.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setUploadStatus(`Error: ${msg}`);
    } finally {
      setIsUploading(false);
    }
  }, []);

  const dropzoneProps = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
  });

  return { isUploading, uploadStatus, uploadedFiles, dropzoneProps };
}
