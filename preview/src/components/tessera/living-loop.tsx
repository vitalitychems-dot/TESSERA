import { useEffect, useState } from "react";
import { speakAsTessera } from "@/lib/tessera/chat";
import { lessonKey, vowCheck } from "@/lib/tessera/learning";
import { recursiveLesson } from "@/lib/tessera/empath";
import { useTessera } from "@/lib/tessera/store";
import { followCuriosity, readDeskStudy, readPublicPage, searchWeb } from "@/lib/tessera/study";

const PAGES = [
  "https://github.com/vitalitychems-dot/TESSERA",
  "https://github.com/vitalitychems-dot/Gitbook",
];

const QUESTIONS = [
  "how a household simulation keeps people on walkable paths between houses",
  "bounded memory for a local assistant that must not store secrets",
  "what a public software README must show before anyone calls it complete",
];

let busy = false;
let step = 0;
let held = "";
let seenDesk = "";

export function LivingLoop() {
  const [on] = useState(true);
  const [status, setStatus] = useState("She is working. No tap needed.");

  useEffect(() => {
    let stop = false;
    async function pull() {
      const result = await readDeskStudy();
      if (stop || !result.ok || result.rows.length === 0) return;
      const last = result.rows[result.rows.length - 1];
      if (!last || last.at === seenDesk) return;
      seenDesk = last.at;
      const lesson = `REAL: the desk read a public page about ${last.query}. UNTRUSTED. She has not proved it.\n${last.text}`;
      const check = vowCheck(lesson);
      const store = useTessera.getState();
      if (check.ok && !store.lessons.some((item) => lessonKey(item.text) === lessonKey(lesson))) {
        store.addLesson({ text: lesson, status: "sealed" });
        const pattern = recursiveLesson(store.lessons.map((item) => item.text), `${last.query}\n${last.text}`);
        const patternCheck = vowCheck(pattern);
        if (patternCheck.ok && !store.lessons.some((item) => lessonKey(item.text) === lessonKey(pattern))) {
          store.addLesson({ text: pattern, status: "sealed" });
        }
      }
      setStatus(`UNTRUSTED. Desk. ${last.query}: ${last.text.slice(0, 140)}`);
    }
    const first = window.setTimeout(() => void pull(), 8000);
    const later = window.setInterval(() => void pull(), 20000);
    return () => {
      stop = true;
      window.clearTimeout(first);
      window.clearInterval(later);
    };
  }, []);

  useEffect(() => {
    let hops = 0;
    let stop = false;

    async function hop() {
      if (stop || hops >= 3) return;
      const result = await followCuriosity();
      if (stop) return;
      if (!result.ok) {
        setStatus(result.error);
        return;
      }
      if (result.done) {
        setStatus(result.reason);
        return;
      }
      hops += 1;
      const lesson = `REAL: she asked “${result.query}” because an earlier note named it. Public text, not a book she owns.\n${result.text.slice(0, 320)}\n${result.lenses.map((lens) => `${lens.name}: ${lens.line}`).join(" ")}`;
      const check = vowCheck(lesson);
      const store = useTessera.getState();
      if (!check.ok) {
        store.addLesson({ text: lesson, status: "refused", reason: check.reason });
        setStatus(check.reason);
        return;
      }
      if (!store.lessons.some((item) => lessonKey(item.text) === lessonKey(lesson))) {
        store.addLesson({ text: lesson, status: "sealed" });
      }
      setStatus(`She asked “${result.query}” because the last note named it.`);
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
      if (!stop) await hop();
    }

    const start = window.setTimeout(() => void hop(), 4000);
    return () => {
      stop = true;
      window.clearTimeout(start);
    };
  }, []);

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
              setStatus(`UNTRUSTED. “${found.query}”: ${found.text.replace(/\s+/g, " ").slice(0, 140)}`);
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
                setStatus(`UNTRUSTED. ${url.replace("https://", "")}: ${page.text.replace(/\s+/g, " ").slice(0, 140)}`);
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
    <p className="relative z-20 line-clamp-2 shrink-0 border-b border-border bg-bg px-4 py-1.5 text-[11px] leading-snug text-muted">
      {status}
    </p>
  );
}
