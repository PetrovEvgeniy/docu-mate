"use client"

import { useState } from "react"
import { signOut, useSession } from "next-auth/react"
import { TABS } from "@/lib/constants"
import type { Tab } from "@/lib/types"
import { User, LogOut, HardDrive, ChevronDown } from "lucide-react"
import { useStorage } from "@/contexts/StorageContext"

interface AppHeaderProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

export function AppHeader({ activeTab, onTabChange }: AppHeaderProps) {
  const { data: session } = useSession()
  const { storage } = useStorage()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const storageUsedMB = storage
    ? (storage.used_bytes / (1024 * 1024)).toFixed(2)
    : "0.00"
  const storageLimitMB = storage
    ? (storage.limit_bytes / (1024 * 1024)).toFixed(2)
    : "81.92"
  const storagePercentage = storage?.percentage_used || 0

  return (
    <header className="border-b border-neutral-800 p-6 flex justify-between items-center bg-neutral-900/50 backdrop-blur-md sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <img
          src="/favicon.png"
          alt="DocuMate logo"
          className="w-10 h-10 rounded-xl object-cover shadow-lg shadow-indigo-500/20"
        />
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
          DocuMate
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <nav className="flex p-1 bg-neutral-900 rounded-lg border border-neutral-800">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                activeTab === id
                  ? "bg-neutral-800 text-white shadow-sm"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-800/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>

        {session?.user && (
          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <User className="w-4 h-4" />
              <span className="text-sm font-medium">{session.user.name}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${isMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {isMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-64 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl z-20">
                  <div className="p-4 border-b border-neutral-800">
                    <div className="text-sm text-neutral-400 mb-1">Signed in as</div>
                    <div className="text-sm font-medium truncate">{session.user.email}</div>
                  </div>

                  <div className="p-4 border-b border-neutral-800">
                    <div className="flex items-center gap-2 text-sm text-neutral-400 mb-2">
                      <HardDrive className="w-4 h-4" />
                      <span>Storage</span>
                    </div>
                    <div className="flex justify-between text-xs text-neutral-500 mb-1">
                      <span>{storageUsedMB} MB used</span>
                      <span>{storageLimitMB} MB</span>
                    </div>
                    <div className="w-full bg-neutral-800 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          storagePercentage > 90
                            ? "bg-red-500"
                            : storagePercentage > 70
                            ? "bg-yellow-500"
                            : "bg-blue-500"
                        }`}
                        style={{ width: `${Math.min(storagePercentage, 100)}%` }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setIsMenuOpen(false)
                      signOut({ callbackUrl: "/login" })
                    }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-neutral-800 transition-colors rounded-b-lg"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
