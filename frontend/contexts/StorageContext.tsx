"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useSession } from "next-auth/react";
import { getStorageInfo } from "@/services/documentApi";
import type { StorageInfo } from "@/lib/types";

interface StorageContextType {
  storage: StorageInfo | null;
  refreshStorage: () => Promise<void>;
}

const StorageContext = createContext<StorageContextType | null>(null);

export function StorageProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [storage, setStorage] = useState<StorageInfo | null>(null);

  const refreshStorage = useCallback(async () => {
    if (!session?.user?.accessToken) return;

    try {
      const info = await getStorageInfo(session.user.accessToken);
      setStorage(info);
    } catch (error) {
      console.error("Failed to fetch storage:", error);
    }
  }, [session?.user?.accessToken]);

  useEffect(() => {
    refreshStorage();
  }, [refreshStorage]);

  return (
    <StorageContext.Provider value={{ storage, refreshStorage }}>
      {children}
    </StorageContext.Provider>
  );
}

export function useStorage() {
  const context = useContext(StorageContext);
  if (!context) {
    throw new Error("useStorage must be used within StorageProvider");
  }
  return context;
}
