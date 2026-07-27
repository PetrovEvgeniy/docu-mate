import { MessageSquare } from "lucide-react";

export function EmptyChatState() {
  return (
    <div className="m-auto text-center flex flex-col items-center gap-4 text-neutral-500">
      <div className="w-16 h-16 bg-neutral-800 rounded-2xl flex items-center justify-center rotate-3 shadow-lg">
        <MessageSquare className="w-8 h-8 text-indigo-500" />
      </div>
      <h3 className="text-xl font-medium text-neutral-300">Ask DocuMate</h3>
      <p className="max-w-xs">
        Ask questions about the documents you&apos;ve uploaded to the knowledge base.
      </p>
    </div>
  );
}
