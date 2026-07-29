import { API_BASE } from "@/lib/constants"
import type { UploadedFile, StorageInfo } from "@/lib/types"

export async function getDocuments(
  accessToken: string,
): Promise<UploadedFile[]> {
  const response = await fetch(`${API_BASE}/documents`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error("Failed to fetch documents")
  }

  return response.json()
}

export async function deleteDocument(
  fileId: string,
  accessToken: string,
): Promise<StorageInfo> {
  const response = await fetch(`${API_BASE}/documents/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error("Failed to delete document")
  }

  const data = await response.json()
  return {
    used_bytes: data.storage_used,
    limit_bytes: data.storage_limit,
    used_mb: data.storage_used / (1024 * 1024),
    limit_mb: data.storage_limit / (1024 * 1024),
    percentage_used: (data.storage_used / data.storage_limit) * 100,
  }
}

export async function getStorageInfo(accessToken: string): Promise<StorageInfo> {
  const response = await fetch(`${API_BASE}/storage`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error("Failed to fetch storage info")
  }

  return response.json()
}
