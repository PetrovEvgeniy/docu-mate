import { MessageSquare, Database } from "lucide-react";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const TABS = [
  { id: "data" as const, label: "Data Sources", icon: Database },
  { id: "chat" as const, label: "Chat", icon: MessageSquare },
];

export const statusClasses = {
  success: "bg-green-500/10 border-green-500/30 text-green-400",
  error: "bg-red-500/10 border-red-500/30 text-red-400",
  info: "bg-blue-500/10 border-blue-500/30 text-blue-400",
};

export function getStatusVariant(status: string): keyof typeof statusClasses {
  if (status.toLowerCase().includes("success")) return "success";
  if (status.toLowerCase().includes("error")) return "error";
  return "info";
}
