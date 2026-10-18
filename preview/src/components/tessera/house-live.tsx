import { useState } from "react";
import { Chamber } from "./chamber";
import { MindChart } from "./mind-chart";
import { WorldStage } from "./world-stage";
import { TESSERA } from "@/lib/tessera/identity";
import { openPulls } from "@/lib/tessera/github-desk";
import { boardFromPulls } from "@/lib/tessera/foreman";

/** The house fills the screen. Eye, brain, talk, and the open-pull wall sit on top of it. */

type Pull = { repo: string; number: number; title: string; state: string };

export function HouseLive() {
  const [sheet, setSheet] = useState<"" | "brain" | "talk" | "wall">("");
  const [rows, setRows] = useState<Pull[]>([]);
  const [wallNote, setWallNote] = useState("Not loaded.");

  async function showWall() {
    if (sheet === "wall") {
      setSheet("");
      return;
    }
    setSheet("wall");
    setWallNote("Reading the open pull requests.");
    try {
      const result = await openPulls();
      setRows(result.rows);
      setWallNote(result.ok ? `Open at ${result.at.slice(0, 16).replace("T", " ")} UTC.` : "The pull list could not be read.");
    } catch {
      setRows([]);
      setWallNote("The pull list could not be read.");
    }
  }

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
        <button type="button" className="h-10 border border-white/40 bg-black/45 px-3 text-sm text-white" onClick={() => void showWall()}>
          Wall
        </button>
      </div>
      {sheet ? (
        <div className="absolute inset-x-0 bottom-0 z-20 flex h-[62%] flex-col border-t border-white/20 bg-bg">
          <div className="min-h-0 flex-1 overflow-hidden">
            {sheet === "brain" ? <MindChart /> : null}
            {sheet === "talk" ? <Chamber /> : null}
            {sheet === "wall" ? (
              <div className="h-full overflow-y-auto px-4 py-3">
                <p className="text-xs tracking-[0.16em] text-muted uppercase">Task wall</p>
                <p className="mt-1 text-sm text-fg">{wallNote}</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {boardFromPulls(rows).tasks.map((task) => (
                    <li key={task.id} className="border border-border px-3 py-2 text-sm">
                      <span className="text-muted">{task.status}</span>
                      <span className="mt-1 block text-fg">{task.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
