import { useEffect, useState } from "react";
import { HER_CHRONICLE } from "@/lib/tessera/chronicle";
import { convene, type Turn } from "@/lib/tessera/sitting";
import { useTessera } from "@/lib/tessera/store";

type Vote = { name: string; vote: "keep" | "hold" };

const TOPICS = [
  "What may I conclude from the vault?",
  "What would better the world from this room",
  "How to make this program more real",
];

export function ConversationsView() {
  const messages = useTessera((s) => s.messages);
  const lessons = useTessera((s) => s.lessons);
  const [n, setN] = useState(0);
  const [spoken, setSpoken] = useState<Turn[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const topic = TOPICS[n % TOPICS.length];

  useEffect(() => {
    const sitting = convene(topic);
    let i = 0;
    let later = 0;
    setSpoken([]);
    setVotes([]);
    const id = window.setInterval(() => {
      const turn = sitting.turns[i];
      if (!turn) {
        window.clearInterval(id);
        later = window.setTimeout(() => setN((value) => value + 1), 1600);
        return;
      }
      setSpoken((prev) => [...prev, turn]);
      setVotes((prev) => [...prev, { name: turn.name, vote: /claim|not |do not|closed/i.test(turn.text) ? "hold" : "keep" }]);
      i += 1;
    }, 1400);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(later);
    };
  }, [n, topic]);

  const keep = votes.filter((vote) => vote.vote === "keep").length;
  const hold = votes.filter((vote) => vote.vote === "hold").length;

  return (
    <div className="px-4 py-6 pb-24 sm:px-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted uppercase">Conversations</p>
          <h2 className="mt-1 font-display text-3xl tracking-tight">They speak on their own</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            These speakers are parts of this page. They are not Cursor, Grok Bot, or Replit, and they do not post under those names.
          </p>
        </div>

        <section className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs tracking-[0.18em] text-subtle uppercase">Live topic</p>
          <p className="mt-2 text-sm text-fg">{topic}</p>
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
