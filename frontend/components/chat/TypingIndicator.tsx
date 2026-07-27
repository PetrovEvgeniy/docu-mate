import { Loader2 } from "lucide-react";

export function TypingIndicator() {
  return (
    <div className="flex gap-4 max-w-[80%] self-start">
      <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center shrink-0">
        <Loader2 className="w-4 h-4 text-neutral-400 animate-spin" />
      </div>
      <div className="px-5 py-3 rounded-2xl bg-neutral-800 text-neutral-400 rounded-tl-sm border border-neutral-700">
        Thinking...
      </div>
    </div>
  );
}
