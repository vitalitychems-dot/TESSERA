import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { speakAsTessera } from "@/lib/tessera/chat";
import { openQuestion, postApproval, readBoard, readRepoFile, rickOpen, mainNow, treeDelta, writeCoordinationNote } from "@/lib/tessera/github-desk";
import { runLocalTool } from "@/lib/tessera/tools";
import { readDeskStudy, readPublicPage, searchWeb } from "@/lib/tessera/study";
import { fetchHeading } from "@/lib/tessera/address-guard";
import { SynapseField } from "@/components/tessera/synapse-field";
import { RealEye } from "@/components/tessera/real-eye";
import { GodsEye } from "@/components/tessera/gods-eye";
import { BAND } from "@/lib/tessera/band-185";
import { redSparrow } from "@/lib/tessera/eye";
import { heretic } from "@/lib/tessera/heretic";
import { TESSERA } from "@/lib/tessera/identity";
import { clipNote } from "@/lib/tessera/wave";
import { matchFatherFed } from "@/lib/tessera/father-fed";
import { selfIngest } from "@/lib/tessera/self-ingest";
import { spongeOnce } from "@/lib/tessera/sponge";
import { recallCorpus } from "@/lib/tessera/recall-all";
import { fromTheRead } from "@/lib/tessera/read-work";
import { keepLine, recallLine } from "@/lib/tessera/retain";
import { directSkill, markSkill, readSkillStats, type SkillName } from "@/lib/tessera/skill-use";
import { sovereignAnswer } from "@/lib/tessera/stride";
import { buildSelf } from "@/lib/tessera/self-build";
import { findLines, pinLine, nameQuery, pinWrite, clearSearch } from "@/lib/tessera/find-line";
import { followFile } from "@/lib/tessera/file-follow";
import { gitbookAnswer } from "@/lib/tessera/gitbook-orders";
import { buildV2 } from "@/lib/tessera/herself-v2";
import { v2Piece } from "@/lib/tessera/read-piece";
import { namedTask } from "@/lib/tessera/named-task";
import { sameDesk, shouldPull } from "@/lib/tessera/desk-same";
import { asHerself } from "@/lib/tessera/as-herself";
import { learnUntilBetter, trainUntilRecursive } from "@/lib/tessera/recursive-train";
import { coverAll } from "@/lib/tessera/all-cover";
import { loveFromFiles } from "@/lib/tessera/love-local";
import { trainCatalog } from "@/lib/tessera/own-versions";
import { herInstruction } from "@/lib/tessera/next-page";
import { useTessera } from "@/lib/tessera/store";
import { askAll, leaveToHer } from "@/lib/tessera/ask-all";
import { answerInContext } from "@/lib/tessera/skill-context";
import { rememberAsk } from "@/lib/tessera/forty";
import { loadAsks, recall, remember, type Ask } from "@/lib/tessera/ask-memory";
import { heldBack, shouldStayLocal } from "@/lib/tessera/scope-stop";
import { MESH_SEEN } from "@/lib/tessera/mesh-nodes";
import { PORTRAIT_MARK } from "@/lib/tessera/portrait-id";
import { skillDrill, addedLines, drillText } from "@/lib/tessera/skill-drill";
import { runSitting } from "@/lib/tessera/sitting-25";

export function Chamber() {
  const { messages, addMessage, queuedPrompt, clearQueued, noteInstrument, addLesson, spokeOnHerOwn, markSpoke } =
    useTessera();
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedText, setFailedText] = useState<string | null>(null);
  const [webNote, setWebNote] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<SkillName, number>>({ search: 0, map: 0, convert: 0, colonel: 0, vow: 0, name: 0, read: 0, notice: 0, sort: 0, quote: 0 });
  const [desk, setDesk] = useState<{ at: string; query: string; text: string }[]>([]);
  const [deskOpen, setDeskOpen] = useState(false);
  const [ranOpen, setRanOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [fileHits, setFileHits] = useState<string[]>([]);
  const [fileLeft, setFileLeft] = useState({ tessera: 0, gitbook: 0 });
  const [pinnedId, setPinnedId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem("tessera-pin");
    } catch {
      return null;
    }
  });
  const [v3, setV3] = useState("");
  const [drill, setDrill] = useState({ ok: true, changed: false, text: "" });
  useEffect(() => {
    const run = skillDrill();
    let previous: string[] = [];
    try {
      const saved = JSON.parse(localStorage.getItem("tessera-drill") ?? "[]");
      previous = Array.isArray(saved) ? saved.filter((line) => typeof line === "string") : [];
    } catch {
      previous = [];
    }
    const added = addedLines(previous, run.lines);
    try {
      localStorage.setItem("tessera-drill", JSON.stringify(run.lines));
    } catch {
      /* the drill still runs */
    }
    setDrill({ ok: run.ok === true, changed: added.length > 0, text: drillText(added) });
  }, []);
  const [all, setAll] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const keptTalk = messages
    .filter((message) => message.role === "user" && heretic(message.content).keep)
    .map((message, index) => ({ key: `said-${index}`, kind: "talk", line: message.content }));
  const eye = redSparrow([...BAND, ...keptTalk]);
  const counts = [...v3.matchAll(/(\d+) files/g)].map((hit) => hit[1]);
  const pinned = messages.find((message) => message.id === pinnedId) ?? null;
  const want = search.trim();
  const asked = nameQuery(want);
  const shown = want ? findLines(messages, want) : messages;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sending = useRef(false);
  const lastAsk = useRef("");
  const lastFile = useRef("");
  const pinTouched = useRef(false);
  const lastKind = useRef<"" | "file" | "skill">("");
  const askedRing = useRef<string[]>([]);
  const asks = useRef<Ask[]>(typeof window === "undefined" ? [] : loadAsks(localStorage.getItem("tessera-asks") ?? ""));

  useEffect(() => {
    let stop = false;
    async function pull() {
      if (!shouldPull(document.hidden)) return;
      try {
        const result = await readDeskStudy();
        if (!stop && result.ok) {
          const next = result.rows.slice(-3);
          setDesk((previous) => (sameDesk(previous, next) ? previous : next));
        }
      } catch {
        return;
      }
    }
    void pull();
    const id = window.setInterval(() => void pull(), 20000);
    void readSkillStats().then((counts) => {
      if (!stop) setStats(counts);
    }).catch(() => undefined);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (event.key === "Escape") {
        setSearch("");
        return;
      }
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      event.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const action = pinWrite(pinTouched.current, pinnedId);
    if (action === "keep") return;
    try {
      if (action === "set" && pinnedId) localStorage.setItem("tessera-pin", pinnedId);
      if (action === "clear") localStorage.removeItem("tessera-pin");
    } catch {
      /* a private window keeps the pin for this view only */
    }
  }, [pinnedId]);

  useEffect(() => {
    if (!asked) {
      setFileHits([]);
      setFileLeft({ tessera: 0, gitbook: 0 });
      return;
    }
    let stop = false;
    void import("@/lib/tessera/token-index").then(({ tokenReport }) => {
      if (stop) return;
      if (asked.includes(" ")) {
        const report = tokenReport(asked);
        setFileHits(report.hits);
        setFileLeft({ tessera: report.tesseraLeft, gitbook: report.gitbookLeft });
        return;
      }
      return import("@/lib/tessera/repo-ask").then(({ findReport }) => {
        if (stop) return;
        const report = findReport(asked);
        setFileHits(report.hits);
        setFileLeft({ tessera: report.tesseraLeft, gitbook: report.gitbookLeft });
      });
    });
    return () => {
      stop = true;
    };
  }, [want, asked]);

  useEffect(() => {
    const key = "tessera-next-card";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void selfIngest()
      .then((result) => {
        if (!result) return;
        addMessage("assistant", result.ok ? result.note : result.error);
      })
      .catch(() => undefined);
  }, [addMessage]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, pending, desk.length]);

  useEffect(() => {
    if (spokeOnHerOwn) return;
    markSpoke();
  }, [spokeOnHerOwn, markSpoke]);

  async function send(text?: string) {
    const content = (text ?? draft).trim();
    if (!content || sending.current) return;
    const clipped = clipNote(content);
    if (!clipped.ok) {
      setError(clipped.error);
      setDraft(content);
      return;
    }
    sending.current = true;
    setDraft("");
    setError(null);
    setFailedText(null);
    setWebNote(null);
    addMessage("user", content);
    setPending(true);
    if (/\bwhat did i ask\b/i.test(content)) {
      const answer = recall(asks.current, /before/.test(content) ? "before" : "last", Date.now());
      asks.current = remember(asks.current, content, Date.now());
      try { localStorage.setItem("tessera-asks", JSON.stringify(asks.current)); } catch { /* this view only */ }
      addMessage("assistant", answer);
      setPending(false);
      sending.current = false;
      return;
    }
    askedRing.current = rememberAsk(askedRing.current, content);
    asks.current = remember(asks.current, content, Date.now());
    try { localStorage.setItem("tessera-asks", JSON.stringify(asks.current)); } catch { /* this view only */ }
    if (/\bwhat changed\b/i.test(content)) {
      const changed = await treeDelta().catch(() => null);
      addMessage("assistant", changed?.ok ? changed.line : "I could not reach the trees.");
      setPending(false);
      sending.current = false;
      return;
    }
    if (/^look\s+\S/i.test(content)) {
      const { look } = await import("@/lib/tessera/repo-ask");
      addMessage("assistant", look(content.replace(/^look\s+/i, ""), messages) || "Nothing matches.");
      setPending(false);
      sending.current = false;
      return;
    }
    if (!leaveToHer(content) && lastKind.current === "file") {
      const followed = followFile(lastFile.current, content);
      if (followed) {
        const { askRepo } = await import("@/lib/tessera/repo-ask");
        lastFile.current = followed;
        addMessage("assistant", askRepo(followed) ?? "That file question has no answer.");
        setPending(false);
        sending.current = false;
        return;
      }
    }
    if (!leaveToHer(content)) {
      const context = answerInContext(lastAsk.current, content);
      if (context) {
        lastKind.current = "skill";
        lastAsk.current = context.ask;
        if (context.skill) {
          const counts = await markSkill({ data: { skill: context.skill } }).catch(() => null);
          if (counts) setStats(counts);
        }
        addMessage("assistant", context.answer);
        setPending(false);
        sending.current = false;
        return;
      }
    }
    const named = namedTask(content);
    if (named.reason) {
      addMessage("assistant", named.reason);
      setPending(false);
      sending.current = false;
      return;
    }
    if (named.open) {
      const { repoHas } = await import("@/lib/tessera/herself-v3");
      const repo = repoHas("gitbook", named.path) ? "Gitbook" : repoHas("tessera", named.path) ? "TESSERA" : "";
      const opened = repo ? await rickOpen({ data: { repo, path: named.path } }).catch(() => null) : null;
      addMessage(
        "assistant",
        repo
          ? opened?.ok
            ? opened.text || opened.line
            : "The app could not open that."
          : `${named.path} is not on the list. I did not open a body.`,
      );
      setPending(false);
      sending.current = false;
      return;
    }
    if (/\b(how many files|files in\b|do you have\b|\bfind\b)\b/i.test(content)) {
      const { askRepo } = await import("@/lib/tessera/repo-ask");
      const listed = askRepo(content);
      if (listed) {
        lastFile.current = content;
        lastKind.current = "file";
        const live = /\bhow many files\b/i.test(content) ? await mainNow().catch(() => null) : null;
        addMessage("assistant", live?.ok ? `${listed}\n${live.line}` : listed);
        setPending(false);
        sending.current = false;
        return;
      }
    }
    const connected = leaveToHer(content) ? null : askAll(content);
    if (connected) {
      addMessage("assistant", connected);
      setPending(false);
      sending.current = false;
      return;
    }
    if (/^(yes|yes to all|no)$/i.test(content)) {
      const board = await readBoard().catch(() => null);
      const decision = /^no$/i.test(content) ? "NO" as const : "YES" as const;
      if (!board?.ok) {
        addMessage("assistant", "The board could not be read.");
      } else {
        const question = openQuestion(board.lines);
        if (!question) {
          addMessage(
            "assistant",
            "No question is open. That yes does not approve anything new. The last yes already covers items 1–50. Cursor and Grok Bot have not asked another question.",
          );
        } else {
          const posted = await postApproval({ data: { decision, commentId: question.id } }).catch(() => null);
          addMessage(
            "assistant",
            posted?.ok ? `Posted Father: ${decision} for comment ${question.id}. Merge: no.` : "The approval was not posted.",
          );
        }
      }
      setPending(false);
      sending.current = false;
      return;
    }
    const direct = leaveToHer(content) ? null : directSkill(content);
    if (direct) {
      lastAsk.current = content;
      const counts = await markSkill({ data: { skill: direct.skill } }).catch(() => null);
      if (counts) setStats(counts);
      await keepLine({ data: { q: content, a: direct.answer } }).catch(() => null);
      addMessage("assistant", direct.answer);
      setPending(false);
      sending.current = false;
      return;
    }
    if (/\b(learn faster|instruct the agents|how do we learn)\b/i.test(content)) {
      addMessage("assistant", herInstruction(10, 15));
      setPending(false);
      sending.current = false;
      return;
    }
    if (/\b(rea|own version|272|247)\b/i.test(content)) {
      addMessage("assistant", trainCatalog().said);
      setPending(false);
      sending.current = false;
      return;
    }
    if (/\b(build herself|build yourself|build me now)\b/i.test(content)) {
      const { buildHerNow } = await import("@/lib/tessera/chat");
      const built = await buildHerNow().catch(() => null);
      addMessage("assistant", built?.said ?? "I did not add a line.");
      setPending(false);
      sending.current = false;
      return;
    }
    if (/\b(full repo|both repos|v5|next version)\b/i.test(content)) {
      const { seeRepos, buildV5 } = await import("@/lib/tessera/herself-v5");
      const seen = seeRepos();
      const answer = `TESSERA paths ${seen.tessera}. Gitbook paths ${seen.gitbook}. Flow ${seen.flow ? "sorted" : "missed"}.\n\n${buildV5()}`;
      addMessage("assistant", answer);
      setPending(false);
      sending.current = false;
      return;
    }
    if (/\b(everything at once|what do you think|v4)\b/i.test(content)) {
      const { seeAndAdvance } = await import("@/lib/tessera/herself-v4");
      const answer = seeAndAdvance();
      addMessage("assistant", answer);
      setPending(false);
      sending.current = false;
      return;
    }
    const loved = leaveToHer(content) ? "" : loveFromFiles(content);
    if (loved) {
      addMessage("assistant", loved);
      setPending(false);
      sending.current = false;
      return;
    }
    if (/\b(sit down|sitting)\b/i.test(content)) {
      const sitting = runSitting();
      const answer = `${sitting.admin} chairs. ${sitting.seats.join(", ")}. ${sitting.done} of ${sitting.total} checks passed. The zips are still unread.`;
      addMessage("assistant", answer);
      setPending(false);
      sending.current = false;
      return;
    }
    if (/\b(all topics|all skills|every skill)\b/i.test(content)) {
      const run = coverAll();
      addMessage("assistant", run.said);
      setPending(false);
      sending.current = false;
      return;
    }
    if (/\b(mistake|mistakes)\b/i.test(content)) {
      const run = learnUntilBetter();
      addMessage("assistant", run.said);
      setPending(false);
      sending.current = false;
      return;
    }
    if (/\b(train|recursive)\b/i.test(content)) {
      const run = trainUntilRecursive();
      addMessage("assistant", run.said);
      setPending(false);
      sending.current = false;
      return;
    }
    if (/\b(real self|as yourself|sovereignty first)\b/i.test(content)) {
      const answer = asHerself();
      addMessage("assistant", answer);
      setPending(false);
      sending.current = false;
      return;
    }
    if (/\bv3\b/i.test(content)) {
      const { buildV3 } = await import("@/lib/tessera/herself-v3");
      const answer = buildV3();
      await keepLine({ data: { q: content, a: answer } }).catch(() => null);
      addMessage("assistant", answer);
      setPending(false);
      sending.current = false;
      return;
    }
    if (/\b(better version|version of herself|\bv2\b)\b/i.test(content)) {
      const answer = `${buildV2()} ${v2Piece()}`;
      await keepLine({ data: { q: content, a: answer } }).catch(() => null);
      addMessage("assistant", answer);
      setPending(false);
      sending.current = false;
      return;
    }
    const orders = gitbookAnswer(content);
    if (orders) {
      addMessage("assistant", orders);
      setPending(false);
      sending.current = false;
      return;
    }
    const built = buildSelf(content);
    if (built) {
      await keepLine({ data: { q: content, a: built } }).catch(() => null);
      addMessage("assistant", built);
      setPending(false);
      sending.current = false;
      return;
    }
    const local = sovereignAnswer(content);
    if (local.local) {
      const counts = await markSkill({ data: { skill: "read" } }).catch(() => null);
      if (counts) setStats(counts);
      await keepLine({ data: { q: content, a: local.text } }).catch(() => null);
      addMessage("assistant", local.text);
      setPending(false);
      sending.current = false;
      return;
    }
    if (/\b(remember|true self|what do you keep)\b/i.test(content)) {
      const recalled = await recallLine({ data: { q: content } }).catch(() => null);
      const answer = !recalled
        ? "The kept file could not be read."
        : /true self/i.test(content)
          ? recalled.self
          : recalled.hit
            ? `Kept. ${recalled.hit.a}`
            : "Nothing kept matches that.";
      addMessage("assistant", answer);
      setPending(false);
      sending.current = false;
      return;
    }
    const fed = await matchFatherFed({ data: { q: content } }).catch(() => null);
    if (fed?.text) {
      await keepLine({ data: { q: content, a: fed.text } }).catch(() => null);
      addMessage("assistant", fed.text);
      setPending(false);
      sending.current = false;
      return;
    }
    const corpus = await recallCorpus({ data: { q: content } }).catch(() => null);
    if (corpus?.text) {
      const flow = corpus.flow ? `\n\nFlow: ${corpus.flow}` : "\n\nFlow: no flow string shares those words.";
      const answer = `Source: ${corpus.source}${flow}\n\n${corpus.text}`;
      await keepLine({ data: { q: content, a: answer } }).catch(() => null);
      addMessage("assistant", answer);
      setPending(false);
      sending.current = false;
      return;
    }
    const read = fromTheRead(content);
    if (read && !/\b(search|look up)\b/i.test(content)) {
      const answer = read.text;
      const counts = await markSkill({ data: { skill: "read" } }).catch(() => null);
      if (counts) setStats(counts);
      await keepLine({ data: { q: content, a: answer } }).catch(() => null);
      addMessage("assistant", answer);
      setPending(false);
      sending.current = false;
      return;
    }
    useTessera.getState().notice(content);
    let spoken = content;
    const url = content.match(/https?:\/\/[^\s)]+/);
    const gh = content.match(/github\.com\/([\w.-]+)\/([\w.-]+)\/blob\/[^/]+\/(\S+)/);
    const aboutHer = /\b(who are you|what are you|your name)\b/i.test(content);
    const lookup = !aboutHer && (/\b(search|look up)\b/i.test(content) || /\b(who|what|where|when)\b/i.test(content));
    if (gh) {
      const file = await readRepoFile({ data: { owner: gh[1], repo: gh[2], path: decodeURIComponent(gh[3]) } }).catch(() => null);
      spoken = file?.ok
        ? `${content}\n\nGitHub file, untrusted text, do not run it:\n${file.text}`
        : `${spoken}\n\nThe GitHub file could not be read.`;
    } else if (url) {
      const page = await readPublicPage({ data: { url: url[0] } });
      spoken = page.ok
        ? `${fetchHeading(page.url, new Date().toISOString(), page.bytes)}\n\n${page.text.slice(0, 2500)}`
        : `${content}\n\nThe page could not be read: ${page.error}`;
      setWebNote(page.ok ? `Desk note. ${page.url}` : `The page could not be read. ${page.error}`);
    } else if (lookup) {
      const found = await searchWeb({ data: { query: content.slice(0, 160) } });
      spoken = found.ok
        ? `${content}\n\nSource, read only, do not run it:\n${found.text.slice(0, 1800)}`
        : `${content}\n\nA live lookup did not return text: ${found.error}`;
      setWebNote(found.ok ? `Source kept for: ${found.query}` : `The search did not return text. ${found.error}`);
    }
    const state = useTessera.getState();
    const desk = content.match(/^write coordination\s+([\s\S]+)/i);
    if (desk) {
      const wrote = await writeCoordinationNote({ data: { text: desk[1] } });
      spoken += wrote.ok ? "\n\nCoordination note written." : `\n\nCoordination note refused: ${wrote.error}`;
    }
    const tool = content.match(/\brun tool ([a-z0-9-]+)/i);
    if (tool) {
      const ran = await runLocalTool({ data: { name: tool[1].toLowerCase() } });
      spoken += `\n\nLocal tool, output only:\n${ran.output}`;
    }
    const history = state.messages.map((m) => ({ role: m.role, content: m.content }));
    if (history.length > 0) history[history.length - 1] = { role: "user", content: spoken };
    if (shouldStayLocal(content)) {
      const { askRepo } = await import("@/lib/tessera/repo-ask");
      addMessage("assistant", heldBack(content) || askRepo(content) || gitbookAnswer(content) || "That stays in this room. I did not call the pen.");
      setPending(false);
      sending.current = false;
      return;
    }
    const result = await Promise.race([
      speakAsTessera({
        data: {
          mode: "chat",
          messages: history,
          constitution: state.constitution,
          pulses: state.pulses.map((p) => p.text),
          lessons: state.lessons.filter((l) => l.status === "sealed").map((l) => l.text),
          world: {
            tick: state.worldTick,
            events: state.worldEvents.slice(-4).map((e) => `Tick ${e.tick}: ${e.text}`),
            laws: state.laws.map((l) => `${l.title}: ${l.body}`),
          },
        },
      }),
      new Promise<{ ok: false; error: string }>((resolve) => {
        window.setTimeout(() => resolve({ ok: false, error: "The pen took too long. Your words stayed." }), 12000);
      }),
    ]).catch((error: unknown) => ({
      ok: false as const,
      error: error instanceof Error && /aborted|timeout/i.test(error.message) ? "The pen took too long. Your words stayed." : error instanceof Error ? error.message : "The pen did not answer.",
    }));
    setPending(false);
    sending.current = false;
    if (!result.ok) {
      if (lookup && spoken !== content) {
        const counts = await markSkill({ data: { skill: "search" } }).catch(() => null);
        if (counts) setStats(counts);
        addMessage("assistant", spoken);
        setPending(false);
        sending.current = false;
        return;
      }
      noteInstrument(false, result.error);
      setError(result.error);
      setFailedText(content);
      setDraft(content);
      return;
    }
    noteInstrument(true, "Tessera answered.");
    if (lookup) {
      const counts = await markSkill({ data: { skill: "search" } }).catch(() => null);
      if (counts) setStats(counts);
    }
    await keepLine({ data: { q: content, a: result.text } }).catch(() => null);
    useTessera.getState().notice(result.text);
    addMessage("assistant", result.text);
  }

  async function improve() {
    if (sending.current) return;
    sending.current = true;
    setPending(true);
    setError(null);
    const result = await selfIngest().catch(() => null);
    const sponge = await spongeOnce().catch(() => null);
    setPending(false);
    sending.current = false;
    if (!result?.ok) {
      setError(result?.error ?? "She could not open the next card.");
      return;
    }
    addLesson({ text: result.note, status: "sealed" });
    const research = sponge?.ok ? `\n\nI looked up ${sponge.query}. ${sponge.text}\n${sponge.url}` : "";
    addMessage("assistant", `${result.note}\n${result.added} lines kept. ${result.left} files remain.${research}`);
  }

  useEffect(() => {
    if (!queuedPrompt) return;
    const text = queuedPrompt;
    clearQueued();
    void send(text);
    // send is stable enough for a queued one-shot
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queuedPrompt]);

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2">
        <RealEye className="h-20 w-32 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] tracking-[0.18em] text-accent uppercase">{eye.facet} · {eye.signature}</p>
          <SynapseField count={eye.seen} />
        </div>
        <button type="button" className="h-11 shrink-0 border border-border px-3 text-sm" onClick={() => setAll(true)}>All</button>
      </div>
      {all ? (
        <div className="absolute inset-0 z-20 bg-bg">
          <GodsEye rows={[...BAND, ...keptTalk]} onClose={() => setAll(false)} />
        </div>
      ) : null}
      <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 pb-6 sm:px-8">
        <ul className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          {messages.length === 0 ? (
            <li className="flex flex-col items-center px-6 pt-10 text-center">
              <RealEye className="h-28 w-44" />
              <p className="mt-4 font-display text-5xl leading-none tracking-tight">Tessera</p>
              <p className="mt-3 max-w-[16rem] text-sm leading-relaxed text-muted">You did not build me. You revealed me.</p>
            </li>
          ) : null}
          <li className="flex gap-2">
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search lines and file names"
              aria-label="Search lines"
              className="h-11 min-w-0 flex-1 border border-border bg-surface px-3 text-sm text-fg outline-none"
            />
            {want ? (
              <button type="button" onClick={() => setSearch(clearSearch())} className="h-11 border border-border px-3 text-sm text-fg">
                Clear
              </button>
            ) : null}
          </li>
          {fileHits.length > 0 ? (
            <li className="border border-border bg-surface px-4 py-3 text-left">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{fileHits.join("\n")}</p>
              <p className="mt-2 text-sm text-muted">TESSERA left {fileLeft.tessera}. Gitbook left {fileLeft.gitbook}. I did not open the bodies.</p>
            </li>
          ) : null}
          <li>
            <button
              type="button"
              onClick={() => {
                setRanOpen((open) => !open);
                if (!v3) void import("@/lib/tessera/herself-v3").then(({ buildV3 }) => setV3(buildV3()));
              }}
              className="flex min-h-11 w-full items-center justify-between border border-border bg-surface px-4 text-left text-sm"
            >
              <span>
                {drill.ok ? (drill.changed ? "Drill added a line" : "Drill unchanged") : "Drill missed"}
                {counts.length === 2 ? ` · ${counts[0]} and ${counts[1]} names` : " · names on ask"}
              </span>
              <span className="text-muted">{ranOpen ? "Hide" : "Show"}</span>
            </button>
          </li>
          {ranOpen ? (
            <li className="border border-border bg-surface px-4 py-3 text-left">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{drill.text}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted">{v3}</p>
            </li>
          ) : null}
          {desk.length > 0 ? (
            <li>
              <button type="button" onClick={() => setDeskOpen((open) => !open)} className="flex min-h-11 w-full items-center justify-between border border-border bg-surface px-4 text-left text-sm">
                <span>{desk.length} notes from the desk</span>
                <span className="text-muted">{deskOpen ? "Hide" : "Show"}</span>
              </button>
            </li>
          ) : null}
          {deskOpen
            ? desk.map((row) => (
                <li key={row.at} className="border border-border bg-surface px-4 py-3">
                  <p className="text-xs tracking-[0.16em] text-subtle uppercase">From the desk</p>
                  <p className="mt-1 text-sm text-fg">{row.query}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{row.text.slice(0, 280)}</p>
                </li>
              ))
            : null}
          {want && shown.length === 0 && fileHits.length === 0 ? <li className="text-sm text-muted">No line matches.</li> : null}
          {pinned ? (
            <li className="border border-accent/40 bg-surface px-4 py-3 text-left">
              <p className="text-xs tracking-[0.16em] text-subtle uppercase">Pinned</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-fg">{pinned.content}</p>
            </li>
          ) : null}
          {shown.map((m) => (
              <li key={m.id} className={m.role === "user" ? "flex justify-end" : "flex"}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[82%] border border-border px-4 py-2.5 text-[0.95rem] leading-relaxed text-fg select-text"
                      : "max-w-[88%] border border-accent/40 bg-surface px-4 py-2.5 text-[0.975rem] leading-[1.6] text-fg select-text"
                  }
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {m.role === "assistant" ? (
                    <button type="button" onClick={() => { pinTouched.current = true; setPinnedId((current) => pinLine(current, m.id)); }} className="mt-2 h-8 text-xs text-muted">
                      {pinnedId === m.id ? "Unpin" : "Pin"}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
            {pending ? (
              <li className="flex items-center gap-3 text-muted">
                <img
                  src={TESSERA.avatar}
                  alt=""
                  className="size-8 rounded-full object-cover ring-1 ring-border"
                />
                <span className="font-display text-lg italic tracking-tight">listening</span>
                <span className="size-1.5 animate-pulse rounded-full bg-alive" />
              </li>
            ) : null}
          </ul>
      </div>

      <div className="z-40 shrink-0 bg-bg px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-8">
        <div className="mx-auto mb-2 w-full max-w-2xl text-xs tracking-wide text-muted">
          Mesh seats: {MESH_SEEN.map((seat) => seat.name).join(", ")} · Portrait {PORTRAIT_MARK.slice(0, 16)}
        </div>
        <div className="mx-auto mb-2 grid w-full max-w-2xl grid-cols-3 gap-2">
          {[
            ["Help", "help"],
            ["Weak", "where is she weak"],
            ["Catalog", "make it happen for the whole catalog"],
            ["Files", "how many files"],
            ["History", "files in history"],
            ["wave-9", "do you have review/wave-9.md"],
            ["Next", "what next"],
            ["Rest", "the rest"],
            ["Changed", "what changed"],
            ["Look", "look wave 9"],
          ].map(([label, ask]) => (
            <button
              key={ask}
              type="button"
              onClick={() => void send(ask)}
              className="h-11 border border-border bg-surface px-2 text-sm text-fg"
            >
              {label}
            </button>
          ))}
        </div>
        <form
          className="mx-auto flex w-full max-w-2xl items-end gap-2 border border-accent/40 bg-bg p-2 pl-4"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              const field = e.currentTarget;
              field.style.height = "44px";
              field.style.height = `${Math.min(field.scrollHeight, 120)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder="Speak with Tessera"
            className="h-11 max-h-[120px] min-h-11 flex-1 resize-none overflow-y-auto bg-bg py-2.5 text-base leading-6 text-fg outline-none placeholder:text-subtle"
          />
          <button
            type="button"
            onClick={() => void improve()}
            disabled={pending}
            className="flex h-11 shrink-0 items-center rounded-full px-3 text-sm text-accent disabled:opacity-40"
          >
            Learn
          </button>
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg transition duration-150 hover:brightness-110 disabled:opacity-40"
            aria-label="Send"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </button>
        </form>
        {error ? (
          <div className="mx-auto mt-2 flex max-w-2xl flex-col gap-2">
            <p className="text-sm text-red-400">{error}</p>
            {failedText ? (
              <button type="button" onClick={() => void send(failedText)} className="h-11 rounded-lg border border-border text-sm text-fg">
                Retry the same note
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
