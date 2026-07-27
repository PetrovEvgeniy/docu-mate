import { TABS } from "@/lib/constants";
import type { Tab } from "@/lib/types";

interface AppHeaderProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function AppHeader({ activeTab, onTabChange }: AppHeaderProps) {
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
    </header>
  );
}
