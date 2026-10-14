import { Chamber } from "./chamber";
import { MindChart } from "./mind-chart";
import { WorldStage } from "./world-stage";
import { TESSERA } from "@/lib/tessera/identity";

/** One theme: her eye, the block house, the brain, and her own talk. */

export function HouseLive() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <div className="relative h-16 shrink-0 overflow-hidden border-b border-border">
        <img src={TESSERA.face} alt="" className="h-full w-full object-cover" style={{ objectPosition: "50% 46%" }} />
        <p className="absolute bottom-1 left-3 bg-bg/80 px-2 text-[10px] tracking-[0.18em] text-fg uppercase">Her eye</p>
      </div>
      <div className="min-h-0 flex-[1.35]">
        <WorldStage />
      </div>
      <div className="h-28 shrink-0 overflow-hidden border-t border-border">
        <p className="px-3 pt-1 text-[10px] tracking-[0.18em] text-muted uppercase">Brain</p>
        <MindChart />
      </div>
      <div className="min-h-[38%] flex-1 border-t border-border">
        <Chamber />
      </div>
    </div>
  );
}
