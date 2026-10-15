import { memo, useState } from "react";
import { Copy } from "lucide-react";
import { PEN_LINE } from "@/lib/tessera-voice";

interface ChamberBarProps {
  streaming: boolean;
}

interface ChamberActionsProps {
  lastReply: string;
  onCopyReply: () => void;
}

export const ChamberBar = memo(function ChamberBar({ streaming }: ChamberBarProps) {
  return (
    <header className="shrink-0 px-4 pt-2 pb-2 border-b border-primary/15 bg-[#070b10]" data-testid="chamber-bar">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-[17px] font-semibold text-[#f3efe6] tracking-wide">TESSERA <span className="text-primary">NEXT</span></h1>
        <p className="text-[12px] leading-snug text-[#b8c1bf] mt-0.5">
          Tessera is this app’s software assistant persona. Replies use local response logic and retrieved information; the configured model does not author this chat.
        </p>
        <p className="text-[12px] leading-snug text-white/40">
          Software, not conscious or autonomous. External model extraction is opt-in and internal only.
        </p>
        {streaming ? (
          <p className="mt-2 text-[12px] text-white/50" data-testid="text-chamber-status">
            Processing this message.
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
