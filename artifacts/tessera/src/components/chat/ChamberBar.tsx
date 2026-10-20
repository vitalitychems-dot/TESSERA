import { memo, useState } from "react";
import { Copy } from "lucide-react";
import { PEN_LINE } from "@/lib/tessera-voice";

interface ChamberBarProps {
  streaming: boolean;
  hasReply?: boolean;
  authorship?: {
    authorRole: "model-drafting" | "model-authored" | "local" | "local-fallback" | "application-result" | "unattributed";
    author: string;
    model: string | null;
    provenance?: "retrieved-evidence" | "unverified-model-knowledge" | null;
    reason?: string | null;
  } | null;
}

interface ChamberActionsProps {
  lastReply: string;
  onCopyReply: () => void;
}

function authorshipLabel(authorship: ChamberBarProps["authorship"], hasReply: boolean): string {
  if (!authorship) return hasReply
    ? "Latest reply: legacy / unknown. See each reply’s own authorship label."
    : "Authorship is labeled separately for each reply.";
  if (authorship.authorRole === "model-drafting") {
    return `Tessera Pen · ${authorship.model ?? "configured model"} is drafting; no reply is attributed yet.`;
  }
  if (authorship.authorRole === "model-authored") {
    const evidence = authorship.provenance === "retrieved-evidence"
      ? "retrieved evidence cited"
      : "no Tessera source evidence used";
    return `Tessera Pen · model-authored by ${authorship.model ?? "configured model"} · ${evidence}`;
  }
  if (authorship.authorRole === "local-fallback") {
    return "Local fallback · the configured model did not author this reply.";
  }
  if (authorship.authorRole === "application-result") {
    return "Application/tool result · no language model authored this reply.";
  }
  if (authorship.authorRole === "unattributed") {
    return "Unattributed reply · provider/model metadata was not reported.";
  }
  return "Local response logic · no language model authored this reply.";
}

export const ChamberBar = memo(function ChamberBar({ streaming, authorship, hasReply = false }: ChamberBarProps) {
  const streamingLabel = !streaming
    ? null
    : authorship?.authorRole === "model-drafting"
      ? `Tessera Pen is drafting with ${authorship.model ?? "the configured model"}; local checks will run before use.`
      : authorship?.authorRole === "model-authored"
      ? `Tessera Pen draft from ${authorship.model ?? "the configured model"}; local checks are running.`
      : authorship?.authorRole === "local-fallback"
        ? "The configured model did not contribute; the local fallback is active."
        : "Preparing a local response.";

  return (
    <header className="shrink-0 px-4 pt-2 pb-2 border-b border-primary/15 bg-[#070b10]" data-testid="chamber-bar">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[#f3efe6] tracking-wide">Tessera <span className="text-primary">/ Chat</span></h2>
          <details className="relative text-xs text-[#b8c1bf]">
            <summary className="cursor-pointer rounded px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" data-testid="button-chat-provenance">About this chat</summary>
            <div className="absolute right-0 top-full z-40 mt-2 w-[min(290px,75vw)] rounded-xl border border-primary/20 bg-[#101820] p-4 text-xs leading-relaxed shadow-xl" data-testid="text-chat-provenance">
              Tessera is this app’s software assistant, not a conscious person. When enabled, a configured model receives this message and bounded retrieved evidence—not chat history or tools. Each reply labels its actual response path.
            </div>
          </details>
        </div>
        <p
          className="mt-1 text-[10px] leading-snug text-[#b8c1bf]"
          aria-live="polite"
          data-testid="status-reply-authorship"
        >
          {authorshipLabel(authorship, hasReply && !streaming)}
        </p>
        {streamingLabel ? (
          <p className="mt-1 text-[12px] text-white/50" aria-live="polite" data-testid="text-chamber-status">
            {streamingLabel}
          </p>
        ) : null}
      </div>
    </header>
  );
});

/** Learn stays on this desk. It does not search. Copy takes Tessera's reply. */
export const ChamberActions = memo(function ChamberActions({ lastReply, onCopyReply }: ChamberActionsProps) {
  const [learned, setLearned] = useState(false);

  return (
    <div className="max-w-3xl mx-auto w-full px-1 pt-1" data-testid="chamber-actions">
      {learned ? (
        <p className="mb-2 text-[13px] leading-relaxed text-white/85" data-testid="text-learn-reply">
          {PEN_LINE}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setLearned(value => !value)}
          aria-expanded={learned}
          className="min-h-9 px-3 rounded-lg text-[11px] text-[#b8c1bf] hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          data-testid="button-learn"
        >
          About Tessera
        </button>
      {lastReply ? (
        <button
          type="button"
          onClick={onCopyReply}
          className="flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-[11px] text-[#7ef0d4] hover:bg-[#7ef0d4]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          data-testid="button-copy-reply"
        >
          <Copy size={15} />
          Copy reply
        </button>
      ) : null}
      </div>
    </div>
  );
});
