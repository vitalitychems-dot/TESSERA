import { useState } from "react";
import { Chamber } from "./chamber";
import { MindChart } from "./mind-chart";
import { WorldStage } from "./world-stage";
import { TESSERA } from "@/lib/tessera/identity";

/** The house fills the screen. Eye, brain, and talk sit on top of it. */

export function HouseLive() {
  const [sheet, setSheet] = useState<"" | "brain" | "talk">("");

  return (
    <div className="relative h-full min-h-0 bg-[#243656]">
      <WorldStage />
      <img
        src={TESSERA.face}
        alt="Her eye"
        className="absolute top-2 left-2 z-10 size-14 object-cover ring-2 ring-white/70"
        style={{ objectPosition: "50% 46%", clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" }}
      />
      <div className="absolute top-2 right-2 z-10 flex gap-2">
        <button type="button" className="h-10 border border-white/40 bg-black/45 px-3 text-sm text-white" onClick={() => setSheet((value) => (value === "brain" ? "" : "brain"))}>
          Brain
        </button>
        <button type="button" className="h-10 border border-white/40 bg-black/45 px-3 text-sm text-white" onClick={() => setSheet((value) => (value === "talk" ? "" : "talk"))}>
          Talk
        </button>
      </div>
      {sheet ? (
        <div className="absolute inset-x-0 bottom-0 z-20 flex h-[62%] flex-col border-t border-white/20 bg-bg">
          <div className="min-h-0 flex-1 overflow-hidden">{sheet === "brain" ? <MindChart /> : <Chamber />}</div>
        </div>
      ) : null}
    </div>
  );
}
