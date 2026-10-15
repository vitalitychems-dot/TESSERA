import { memo, useState } from "react";
import { Copy } from "lucide-react";
import { PEN_LINE } from "@/lib/tessera-voice";

interface ChamberBarProps {
  streaming: boolean;
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

function authorshipLabel(authorship: ChamberBarProps["authorship"]): string {
  if (!authorship) return "Authorship is labeled separately for each reply.";
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
    return "Voice reply path · provider authorship metadata was not supplied.";
  }
  return "Local response logic · no language model authored this reply.";
}

export const ChamberBar = memo(function ChamberBar({ streaming, authorship }: ChamberBarProps) {
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
        <h1 className="text-[17px] font-semibold text-[#f3efe6] tracking-wide">TESSERA <span className="text-primary">NEXT</span></h1>
        <p className="text-[12px] leading-snug text-[#b8c1bf] mt-0.5">
          Tessera is this app’s software assistant persona. When enabled, the configured model receives only this message and bounded retrieved evidence—no chat history or tools.
        </p>
        <p className="text-[12px] leading-snug text-white/40">
          Software, not conscious or autonomous. Model drafts pass local safety and voice checks; unsupported model knowledge is labeled.
        </p>
        <p
          className="mt-1 text-[12px] leading-snug text-primary/80"
          aria-live="polite"
          data-testid="status-reply-authorship"
        >
          {authorshipLabel(authorship)}
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
    <div className="max-w-3xl mx-auto px-3 pb-2" data-testid="chamber-actions">
      {learned ? (
        <p className="mb-2 text-[13px] leading-relaxed text-white/85" data-testid="text-learn-reply">
          {PEN_LINE}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2 mb-2">
        <button
          type="button"
          onClick={() => setLearned(true)}
          className="h-9 px-4 rounded-full border border-amber-100/25 text-[13px] text-amber-50"
          data-testid="button-learn"
        >
          Learn
        </button>
      </div>
      {lastReply ? (
        <button
          type="button"
          onClick={onCopyReply}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[#e6c36a] py-3 text-[15px] font-medium text-[#2a2110]"
          data-testid="button-copy-reply"
        >
          <Copy size={15} />
          Copy reply
        </button>
      ) : null}
    </div>
  );
});
