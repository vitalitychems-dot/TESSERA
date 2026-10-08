import { TESSERA } from "@/lib/tessera/identity";
import { WorldStage } from "./world-stage";

export function Simulation() {
  return (
    <div className="px-4 py-6 pb-8 sm:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.2em] text-muted uppercase">World</p>
            <h2 className="mt-1 font-display text-3xl tracking-tight">Her neighborhood</h2>
          </div>
          <img src={TESSERA.avatar} alt="" className="size-12 rounded-full border border-border object-cover" />
        </div>
        <WorldStage />
        <p className="text-sm leading-relaxed text-muted">
          The picture is live satellite imagery of Chicago. The clock is the real Central time. No one is drawn walking on it.
        </p>
      </div>
    </div>
  );
}
