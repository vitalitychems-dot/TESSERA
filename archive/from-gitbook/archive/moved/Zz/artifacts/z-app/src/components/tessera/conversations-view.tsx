import { useEffect, useState } from "react";
import { HER_CHRONICLE } from "@/lib/tessera/chronicle";
import { recallFile } from "@/lib/tessera/ingest";
import { convene, type Turn } from "@/lib/tessera/sitting";
import { useTessera } from "@/lib/tessera/store";

type Vote = { name: string; vote: "keep" | "hold" };

export function ConversationsView() {
  const messages = useTessera((s) => s.messages);
  const lessons = useTessera((s) => s.lessons);
  const [topic, setTopic] = useState("What may I conclude from the vault?");
  const [spoken, setSpoken] = useState<Turn[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [live, setLive] = useState(false);
  const [fileId, setFileId] = useState("");
  const [found, setFound] = useState("");
  const [looking, setLooking] = useState(false);

  useEffect(() => {
    if (!live) return;
    const sitting = convene(topic);
    let i = 0;
    const id = window.setInterval(() => {
      const turn = sitting.turns[i];
      if (!turn) {
        setLive(false);
        window.clearInterval(id);
        return;
      }
      setSpoken((prev) => [...prev, turn]);
      setVotes((prev) => [
        ...prev,
        { name: turn.name, vote: /claim|not |do not|closed/i.test(turn.text) ? "hold" : "keep" },
      ]);
      i += 1;
    }, 2500);
    return () => window.clearInterval(id);
  }, [live, topic]);

  async function recall() {
    if (looking) return;
    setLooking(true);
    setFound("");
    try {
      const result = await recallFile({ data: { id: fileId } });
      setFound(result.ok ? `${result.repo}/${result.path}\n${result.id}\n${result.snippet}` : result.error);
    } finally {
      setLooking(false);
    }
  }

  const keep = votes.filter((vote) => vote.vote === "keep").length;
  const hold = votes.filter((vote) => vote.vote === "hold").length;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted uppercase">Conversations</p>
          <h2 className="mt-1 font-display text-3xl tracking-tight">Topics, turns, votes</h2>
        </div>

        <section className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs tracking-[0.18em] text-subtle uppercase">Live topic</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 text-sm text-fg"
            />
            <button
              type="button"
              disabled={live}
              onClick={() => {
                setSpoken([]);
                setVotes([]);
                setLive(true);
              }}
              className="h-11 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg disabled:opacity-40"
            >
              {live ? "Speaking…" : "Start"}
            </button>
          </div>
          <p className="mt-3 text-sm text-fg">
            Keep {keep} · Hold {hold}
          </p>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {spoken.map((turn) => (
              <li key={turn.name}>
                <span className="text-accent">{turn.name}. </span>
                <span className="text-fg">{turn.text}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs tracking-[0.18em] text-subtle uppercase">Recall a file by id</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={fileId}
              onChange={(e) => setFileId(e.target.value)}
              placeholder="File id"
              className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 text-sm text-fg"
            />
            <button
              type="button"
              disabled={looking || fileId.trim().length < 4}
              onClick={() => void recall()}
              className="h-11 rounded-lg border border-border-strong px-4 text-sm text-fg disabled:opacity-40"
            >
              {looking ? "Looking…" : "Recall"}
            </button>
          </div>
          {found ? <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted">{found}</p> : null}
        </section>

        <section className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs tracking-[0.18em] text-subtle uppercase">Her perspective</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-fg">{HER_CHRONICLE}</p>
        </section>

        <section className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs tracking-[0.18em] text-subtle uppercase">What she has sealed</p>
          <ul className="mt-2 flex flex-col gap-2 text-sm text-muted">
            {lessons.slice(-8).map((lesson) => (
              <li key={lesson.id}>
                {lesson.status === "sealed" ? "Sealed. " : "Refused. "}
                {lesson.text.slice(0, 220)}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs tracking-[0.18em] text-subtle uppercase">Chamber history</p>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {messages.slice(-12).map((message) => (
              <li key={message.id} className="text-fg">
                <span className="text-muted">{message.role === "assistant" ? "Tessera. " : "Father. "}</span>
                {message.content.slice(0, 280)}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
