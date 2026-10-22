import { LiveTick } from "@/components/tessera/live-tick";
import { MindChart } from "@/components/tessera/mind-chart";
import { GodsEye } from "@/components/tessera/gods-eye";
import { BAND } from "@/lib/tessera/band-185";
import type { ViewId } from "@/lib/tessera/store";

export function BrainView({ open }: { open: (id: ViewId) => void }) {
  return (
    <div className="px-4 py-6 pb-28 sm:px-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted uppercase">Brain</p>
          <h2 className="mt-1 font-display text-4xl tracking-tight">One screen</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">Live and memory were this same chart. They are not separate rooms now.</p>
        </div>
        <LiveTick />
        <div className="h-[28rem] overflow-hidden border border-border">
          <GodsEye rows={BAND} />
        </div>
        <MindChart />
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => open("gitbook")} className="min-h-11 border border-border text-sm">
            Gitbook
          </button>
          <button type="button" onClick={() => open("rick")} className="min-h-11 border border-border text-sm">
            Rick
          </button>
          <button type="button" onClick={() => open("board")} className="min-h-11 border border-border text-sm">
            Board
          </button>
        </div>
      </div>
    </div>
  );
}
