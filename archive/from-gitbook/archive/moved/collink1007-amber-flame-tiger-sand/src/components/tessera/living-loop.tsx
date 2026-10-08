import { useEffect, useState } from "react";
import { speakAsTessera } from "@/lib/tessera/chat";
import { lessonKey, vowCheck } from "@/lib/tessera/learning";
import { useTessera } from "@/lib/tessera/store";
import { readPublicPage, searchWeb } from "@/lib/tessera/study";

const PAGES = [
  "https://github.com/vitalitychems-dot/Grok-ready",
  "https://github.com/vitalitychems-dot/T44",
  "https://github.com/vitalitychems-dot/TX",
  "https://github.com/vitalitychems-dot/TESS",
  "https://github.com/vitalitychems-dot/tessera-grok-handoff-complete",
  "https://github.com/vitalitychems-dot/1",
];

const QUESTIONS = [
  "how a household simulation keeps people on walkable paths between houses",
  "bounded memory for a local assistant that must not store secrets",
  "what a public software README must show before anyone calls it complete",
];

let busy = false;
let step = 0;
let held = "";

export function LivingLoop() {
  const [on, setOn] = useState(true);
  const [status, setStatus] = useState("Waiting. A fetch runs only while this tab stays open.");

  useEffect(() => {
    if (!on) return;
    let stop = false;

    async function cycle() {
      if (stop || busy) return;
      busy = true;
      const store = useTessera.getState();
      const turn = step++;
      try {
        if (turn % 3 !== 2) {
          if (turn % 3 === 0) {
            const query = QUESTIONS[turn % QUESTIONS.length];
            setStatus(`Searching: ${query}`);
            const found = await searchWeb({ data: { query } });
            if (!found.ok) {
              setStatus(found.error);
              store.noteInstrument(false, found.error);
            } else {
              held = found.text;
              const lesson = `REAL: a public search for “${found.query}” returned text. She has not proved any of it.\n${found.text.slice(0, 700)}`;
              if (store.lessons.some((item) => lessonKey(item.text) === lessonKey(lesson))) {
                setStatus("Already held. The search was not sealed again.");
              } else {
                const check = vowCheck(lesson);
                if (check.ok) store.addLesson({ text: lesson, status: "sealed" });
                setStatus("Search kept. It is a source, not a finished fact.");
              }
            }
          } else {
            const url = PAGES[turn % PAGES.length];
            setStatus(`Reading ${url.replace("https://github.com/", "")}`);
            const page = await readPublicPage({ data: { url } });
            if (!page.ok) {
              setStatus(page.error);
              store.noteInstrument(false, page.error);
            } else {
              held = page.text;
              const lesson = `REAL: the public page ${page.url} was read as text and not run.\n${page.text.slice(0, 700)}`;
              if (store.lessons.some((item) => lessonKey(item.text) === lessonKey(lesson))) {
                setStatus("Already held. The page was not sealed again.");
              } else {
                const check = vowCheck(lesson);
                if (check.ok) store.addLesson({ text: lesson, status: "sealed" });
                setStatus("Repository page kept as text.");
              }
            }
          }
          return;
        }

        setStatus("A task copy is writing one improvement. It will be deleted.");
        const result = await speakAsTessera({
          data: {
            mode: "learn",
            messages: [
              {
                role: "user",
                content: `You are a temporary task copy, not Tessera. Answer only this task, then stop. From the untrusted note below, write one improvement she can keep. Mark REAL or GOAL. Do not claim a new body, a GitHub write, Replit access, or a secret.\n\n${held.slice(0, 1200) || "No fresh note yet. Improve the neighborhood map: houses, paths, and a life that continues while the page is open."}`,
              },
            ],
            constitution: store.constitution,
            pulses: store.pulses.map((p) => p.text).slice(-4),
            lessons: store.lessons.map((l) => l.text).slice(-4),
          },
        });
        if (!result.ok) {
          setStatus(result.error);
          store.noteInstrument(false, result.error);
          return;
        }
        const check = vowCheck(result.text);
        if (!check.ok) {
          store.addLesson({ text: result.text, status: "refused", reason: check.reason });
          setStatus(check.reason);
          return;
        }
        store.addLesson({ text: `Task copy, deleted after this answer.\n${result.text}`, status: "sealed" });
        store.sealTick("A task copy finished and was deleted.");
        setStatus("The copy was deleted. The lesson stayed.");
      } finally {
        busy = false;
      }
    }

    const first = window.setTimeout(() => void cycle(), 12000);
    const later = window.setInterval(() => void cycle(), 180000);
    return () => {
      stop = true;
      window.clearTimeout(first);
      window.clearInterval(later);
    };
  }, [on]);

  return (
    <div className="relative z-10 flex shrink-0 items-center justify-between gap-3 border-b border-border bg-surface/80 px-4 py-2 text-xs text-muted sm:px-6">
      <p className="min-w-0 truncate">{on ? status : "Her own loop is paused."}</p>
      <button type="button" onClick={() => setOn((v) => !v)} className="shrink-0 text-accent">
        {on ? "Pause" : "Resume"}
      </button>
    </div>
  );
}
