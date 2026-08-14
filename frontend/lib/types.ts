export type Tab = "data" | "chat";

export interface Source {
  filename: string;
  page: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  session_id?: string;
  created_at?: string;
  sources?: Source[];
}

export interface UploadedFile {
  id: string;
  name: string;
  file_size_bytes?: number;
  session_id?: string;
  uploaded_at?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  total_storage_bytes: number;
  storage_limit_bytes: number;
}

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface StorageInfo {
  used_bytes: number;
  limit_bytes: number;
  used_mb: number;
  limit_mb: number;
  percentage_used: number;
}
