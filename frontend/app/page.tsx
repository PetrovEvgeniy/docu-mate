"use client";

import { useState } from "react";
import { AppHeader } from "@/components/ui/AppHeader";
import { ChatView } from "@/components/chat/ChatView";
import { DataSourcesView } from "@/components/data-sources/DataSourcesView";
import { StorageProvider } from "@/contexts/StorageContext";
import type { Tab } from "@/lib/types";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("data");

  return (
    <StorageProvider>
      <div className="min-h-screen h-screen bg-neutral-950 text-neutral-50 font-sans flex flex-col overflow-hidden">
        <AppHeader activeTab={activeTab} onTabChange={setActiveTab} />

        <main className="flex-1 max-w-5xl w-full mx-auto p-6 flex flex-col min-h-0">
          {activeTab === "data" ? <DataSourcesView /> : <ChatView />}
        </main>
      </div>
    </StorageProvider>
  );
}
