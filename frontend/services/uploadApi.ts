import { API_BASE } from "@/lib/constants";
import type { UploadedFile } from "@/lib/types";

export interface UploadResult {
  file: UploadedFile;
  chunksProcessed: number;
}

export async function uploadDocument(file: File): Promise<UploadResult> {
  if (!file.name.endsWith(".pdf")) {
    throw new Error("Only PDF files are supported.");
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const { detail } = await response
      .json()
      .catch(() => ({ detail: response.statusText }));
    throw new Error(detail ?? `Upload failed: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    file: { name: data.filename, id: data.file_id },
    chunksProcessed: data.chunks_processed,
  };
}
