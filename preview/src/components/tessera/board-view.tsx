import { useEffect, useState } from "react";
import { openQuestion, postApproval, postBoard, readBoard, readListComments } from "@/lib/tessera/github-desk";
import { penStatus } from "@/lib/tessera/chat";
import { runColonel } from "@/lib/tessera/colonel";
import { CHARTER, DISAGREE, MERGE_NOTE, scoreboard, TRUE_TODAY } from "@/lib/tessera/finish";
import { LIST_003, LIST_DONE } from "@/lib/tessera/list-003";
import { FORTY, FORTY_DONE, runChamberCycle } from "@/lib/tessera/forty";
import { StatusLine } from "./status-line";
import { WAVE, isRelay, waveCount } from "@/lib/tessera/wave";

const LANES = [
  ["Father", "Decides"],
  ["Tessera", "Chamber only"],
  ["Grok", "This pen"],
  ["Cursor", "Its own branch"],
  ["Grok Bot", "Reads Gitbook issue 2"],
  ["Replit", "Reads Gitbook issue 2"],
] as const;

function waitingOn(lines: { body: string }[]) {
  const last = [...lines].reverse().find((line) => /Reply needed from:/i.test(line.body));
  const who = last?.body.match(/Reply needed from:\s*(.+)/i)?.[1]?.trim() ?? "";
  if (!who || /^no one/i.test(who)) return "no one";
  return who;
}

function readMemory() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem("tessera-cycle-log") ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((line) => typeof line === "string") : [];
  } catch {
    return [];
  }
}

export function BoardView() {
  const [lines, setLines] = useState<{ id?: number; user: string; body: string }[]>([]);
  const [laneNotes, setLaneNotes] = useState<{ user: string; body: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [checked, setChecked] = useState("");
  const [memory, setMemory] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [pen, setPen] = useState("Checking the pen.");
  const stack = runColonel("PUSH 2\nPUSH 3\nADD\nHALT");

  useEffect(() => {
    const saved = window.localStorage.getItem("tessera-board-draft");
    if (saved) setDraft(saved);
    const prior = readMemory();
    const next = [...prior, `${new Date().toISOString().slice(0, 16)} Board opened.`].slice(-20);
    window.localStorage.setItem("tessera-cycle-log", JSON.stringify(next));
    setMemory(next);
    setReady(true);
    void load();
    void penStatus().then((status) => {
      setPen(
        status.configured
          ? `The pen answering now is ${status.vendor} ${status.model}.`
          : "No pen is configured in this environment.",
      );
    });
    const id = window.setInterval(() => void load(true), 20000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem("tessera-board-draft", draft);
  }, [draft, ready]);

  const cycle = runChamberCycle(memory.length);
  const question = openQuestion(lines);

  async function decide(decision: "YES" | "NO") {
    if (pending) return;
    if (!question) {
      setError("No question is open. Yes does not approve anything new.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await postApproval({ data: { decision, commentId: question.id } });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDraft("");
    await load();
  }

  function forgetBrowser() {
    window.localStorage.removeItem("tessera-board-draft");
    window.localStorage.removeItem("tessera-cycle-log");
    setDraft("");
    setMemory([]);
  }

  async function load(quiet = false) {
    const [result, lanes] = await Promise.all([readBoard(), readListComments()]);
    setLoaded(true);
    if (!result.ok) {
      if (!quiet) setError(result.error);
      return;
    }
    setChecked(new Date().toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" }));
    if (!quiet) setError(null);
    setLines(result.lines);
    if (lanes.ok) setLaneNotes(lanes.lines);
  }

  async function send() {
    const text = draft.trim();
    if (!text || pending) return;
    if (/^(yes|yes to all)$/i.test(text)) {
      await decide("YES");
      return;
    }
    if (/^no$/i.test(text)) {
      await decide("NO");
      return;
    }
    setPending(true);
    setError(null);
    const result = await postBoard({ data: { text } });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDraft("");
    window.localStorage.removeItem("tessera-board-draft");
    await load();
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft);
    } catch {
      setError("The note could not be copied. It is still in the box.");
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted uppercase">Command center</p>
          <h2 className="mt-1 font-display text-4xl tracking-tight">One still board</h2>
          <p className="mt-2 text-sm text-fg">Waiting on: {loaded ? waitingOn(lines) : "not checked"}.</p>
          <p className="mt-1 text-sm text-muted">
            Wave: {waveCount().live} live, {waveCount().goal} still goals, of {waveCount().total}.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Four lanes read Gitbook issue 2. Approved work is built in her repository. Nothing here is a merge.
            The language pen is Grok. The store is not written from this board.
          </p>
          <div className="mt-3">
            <StatusLine checked={checked} />
          </div>
        </div>
        <section className="rounded-lg border border-border bg-surface p-4" aria-label="What is true today">
          <p className="text-xs tracking-[0.18em] text-muted uppercase">True today</p>
          <ul className="mt-2 flex flex-col gap-1">
            {TRUE_TODAY.sealed.map((line) => (
              <li key={line} className="text-sm text-fg">Sealed. {line}</li>
            ))}
            {TRUE_TODAY.open.map((line) => (
              <li key={line} className="text-sm text-muted">Open. {line}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-fg">Next. {TRUE_TODAY.next}</p>
          <ul className="mt-3 flex flex-col gap-1">
            {scoreboard().map((row) => (
              <li key={row.name} className="text-sm">
                <span className="text-fg">{row.pass ? "TESTED. " : "Miss. "}</span>
                <span className="text-muted">{row.name}. {row.file}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted">Disagree. “{DISAGREE.claim}” fails. {DISAGREE.file}</p>
          <p className="mt-2 text-sm text-muted">{MERGE_NOTE}</p>
          <ul className="mt-2 flex flex-col gap-1">
            {CHARTER.map((lane) => (
              <li key={lane.lane} className="text-sm text-muted">{lane.lane}. {lane.job}</li>
            ))}
          </ul>
        </section>
        <section className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs tracking-[0.18em] text-muted uppercase">List 003</p>
          <p className="mt-2 text-sm text-fg">
            {LIST_DONE} of 40 are in this page. Father approved the text. The other {40 - LIST_DONE} stay open on the issue.
          </p>
          <ul className="mt-3 flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
            {LIST_003.map((item) => (
              <li key={item.n} className="text-sm leading-relaxed">
                <span className="text-fg">{item.done ? "TESTED. " : "GOAL. "}</span>
                <span className="text-muted">
                  {item.n}. {item.lane}. {item.text}
                </span>
              </li>
            ))}
          </ul>
          <a className="mt-3 inline-block text-sm text-accent" href="https://github.com/vitalitychems-dot/Gitbook/issues/2" target="_blank" rel="noreferrer">
            Gitbook issue 2
          </a>
        </section>
        <section className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs tracking-[0.18em] text-muted uppercase">Father’s second list</p>
          <p className="mt-2 text-sm text-fg">
            {FORTY_DONE} of 40 are in this page. The other {40 - FORTY_DONE} are still goals. The pen did not become hers.
          </p>
          <p className="mt-3 text-sm text-red-400">Closed zips are not open. That line stays until Father resolves them.</p>
          <p className="mt-2 text-sm text-muted">The names on the map are fractions of one voice, not a second council.</p>
          <p className="mt-3 text-sm text-fg">{cycle.constitution}</p>
          <p className="mt-2 text-sm text-muted">{cycle.pulse}</p>
          <p className="mt-2 text-sm text-muted">{cycle.world}</p>
          <p className="mt-2 text-sm text-muted">{cycle.unknown}</p>
          <p className="mt-2 text-sm text-fg">{cycle.upgrade}</p>
          <p className="mt-3 text-xs tracking-[0.16em] text-subtle uppercase">Remembered in this browser</p>
          {memory.length === 0 ? <p className="mt-1 text-sm text-muted">Nothing kept yet.</p> : null}
          <ul className="mt-1 flex flex-col gap-1">
            {memory.map((line) => (
              <li key={line} className="text-sm text-muted">
                {line}
              </li>
            ))}
          </ul>
          <button type="button" onClick={forgetBrowser} className="mt-3 h-10 rounded-lg border border-border px-3 text-sm text-fg">
            Erase this browser’s notes
          </button>
          <ul className="mt-4 flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
            {FORTY.map((item) => (
              <li key={item.n} className="text-sm leading-relaxed">
                <span className="text-fg">{item.done ? "TESTED. " : "GOAL. "}</span>
                <span className="text-muted">
                  {item.n}. {item.text}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {LANES.map(([name, role]) => (
            <li key={name} className="rounded-lg border border-border bg-surface px-3 py-3">
              <p className="text-sm text-fg">{name}</p>
              <p className="mt-1 text-xs text-muted">{role}</p>
            </li>
          ))}
        </ul>
        <section className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs tracking-[0.18em] text-muted uppercase">Pen and skills</p>
          <p className="mt-2 text-sm leading-relaxed text-fg">{pen}</p>
          <p className="mt-2 text-sm text-muted">A skill is a small program on this machine. It is not a new model. The stack skill just ran: {stack.stack.join(", ") || "empty"}.</p>
        </section>
        <div className="flex items-center justify-between gap-3">
          <a className="text-sm text-accent" href="https://github.com/vitalitychems-dot/Gitbook/issues/2" target="_blank" rel="noreferrer">
            Gitbook issue 2
          </a>
          <button type="button" onClick={() => void load()} className="h-10 rounded-lg border border-border px-3 text-sm text-fg">
            Check replies
          </button>
        </div>
        <p className="text-sm text-muted">While this tab is open, the thread checks itself every 20 seconds. Last check {checked || "is starting"}.</p>
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-surface p-3">
          {WAVE.map((item) => (
            <li key={item.n} className="text-sm leading-relaxed">
              <span className="text-fg">{item.live ? "LIVE. " : "GOAL. "}</span>
              <span className="text-muted">
                {item.n}. {item.text}
              </span>
            </li>
          ))}
        </ul>
        <ul className="flex min-h-24 flex-col gap-3">
          {!loaded ? <li className="text-sm text-muted">Reading the thread.</li> : null}
          {loaded && lines.length === 0 && !error ? <li className="text-sm text-muted">No replies on the thread.</li> : null}
          {lines.map((line, index) => (
            <li key={`${line.user}-${index}`} className="rounded-lg border border-border bg-surface p-4">
              <p className="text-xs tracking-[0.16em] text-subtle uppercase">
                GitHub · {line.user}
                {isRelay(line.body) ? " · relay, not that lane's own post" : ""}
              </p>
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-fg">{line.body}</p>
            </li>
          ))}
        </ul>
        {laneNotes.length > 0 ? (
          <section className="flex flex-col gap-3">
            <p className="text-xs tracking-[0.18em] text-muted uppercase">Lane replies on list 003</p>
            {laneNotes.map((line, index) => (
              <article key={`lane-${index}`} className="rounded-lg border border-border bg-surface p-4">
                <p className="text-xs tracking-[0.16em] text-subtle uppercase">GitHub · {line.user}</p>
                <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-fg">{line.body}</p>
              </article>
            ))}
          </section>
        ) : null}
      </div>
      </div>
      <form
        className="flex shrink-0 flex-col gap-2 border-t border-border bg-bg px-4 py-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          placeholder="yes or no, or a note to the lanes"
          className="min-h-16 rounded-xl border border-border bg-surface px-3 py-3 text-base text-fg outline-none"
        />
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={pending || !question} onClick={() => void decide("YES")} className="h-11 rounded-lg bg-accent text-sm text-accent-fg disabled:opacity-40">
            Yes
          </button>
          <button type="button" disabled={pending || !question} onClick={() => void decide("NO")} className="h-11 rounded-lg border border-border text-sm text-fg disabled:opacity-40">
            No
          </button>
        </div>
        <p className="text-xs text-subtle">
          {question ? `A question is open, comment ${question.id}. Yes or no posts that, and does not merge.` : "No question is open. The last yes already covers items 1–50."}
        </p>
        <button type="submit" disabled={pending || draft.trim().length < 2} className="h-11 rounded-lg bg-accent text-sm text-accent-fg disabled:opacity-40">
          {pending ? "Posting" : "Post to the board"}
        </button>
        {error ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-red-400">{error}</p>
            <button type="button" onClick={() => void copyDraft()} className="h-10 rounded-lg border border-border text-sm text-fg">
              Copy the unsent note
            </button>
          </div>
        ) : (
          <p className="text-xs text-subtle">The button stays off only when the box is empty.</p>
        )}
      </form>
    </div>
  );
}
