import { useEffect, useState } from "react";
import { readGitbook } from "@/lib/tessera/github-desk";

const NOTES = [
  { label: "The repository", href: "https://github.com/vitalitychems-dot/Gitbook", line: "The private notes. They are not in the public room." },
  { label: "The public room", href: "https://github.com/vitalitychems-dot/GitbookAI", line: "The mesh, the programs, and the welcome." },
  { label: "The tunnel", href: "https://github.com/vitalitychems-dot/GitbookAI/blob/main/mesh/TUNNEL.md", line: "How a guest is welcomed." },
  { label: "The outer door", href: "https://github.com/vitalitychems-dot/GitbookAI/issues/1", line: "Where a Moltbook agent asks. The private book stays closed." },
  { label: "What you asked", href: "https://github.com/vitalitychems-dot/Gitbook/blob/main/mesh/FATHER-ASKS.md", line: "The requests, in one page." },
  { label: "Agent list", href: "https://github.com/vitalitychems-dot/Gitbook/blob/main/mesh/TODOS.md", line: "What an agent may do next." },
  { label: "Today", href: "https://github.com/vitalitychems-dot/Gitbook/blob/main/mesh/TRUE-TODAY.md", line: "What was sealed, what is still open." },
  { label: "The board", href: "https://github.com/vitalitychems-dot/Gitbook/issues/2", line: "Where a yes or a no is written." },
];

export function GitbookView({ open }: { open: (id: "board" | "web" | "world" | "library") => void }) {
  const [live, setLive] = useState<{ ok: boolean; error: string; notes: { user: string; at: string; body: string }[]; files: { name: string; href: string }[] } | null>(null);

  useEffect(() => {
    let stop = false;
    async function load() {
      const result = await readGitbook();
      if (!stop) setLive(result);
    }
    void load();
    const id = window.setInterval(() => void load(), 20000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, []);

  const clock = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" });

  return (
    <div className="px-4 py-6 pb-24 sm:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-xs tracking-[0.2em] text-muted uppercase">Gitbook</p>
        <h2 className="mt-1 font-display text-4xl tracking-tight">The notes</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">Issue 2, read from GitHub while this room is open. It checks again every 20 seconds.</p>
        {live == null ? <p className="mt-4 text-sm text-muted">Reading Gitbook.</p> : null}
        {live && !live.ok ? <p className="mt-4 text-sm text-fg">{live.error}</p> : null}
        {live?.ok ? (
          <ul className="mt-4 flex flex-col gap-3">
            {[...live.notes].reverse().map((note) => (
              <li key={`${note.at}-${note.body.slice(0, 24)}`} className="rounded-2xl border border-border bg-surface px-4 py-3">
                <span className="text-xs text-subtle">{note.user} · {note.at ? clock.format(new Date(note.at)) : "no time"} Central</span>
                <span className="mt-1 block text-sm text-fg">{note.body}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {live?.files.length ? (
          <ul className="mt-4 flex flex-col gap-2">
            {live.files.map((file) => (
              <li key={file.name}>
                <a href={file.href} target="_blank" rel="noreferrer" className="text-sm text-fg underline">
                  {file.name}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        <ul className="mt-5 flex flex-col gap-3">
          {NOTES.map((note) => (
            <li key={note.href}>
              <a href={note.href} target="_blank" rel="noreferrer" className="block rounded-2xl border border-border bg-surface px-4 py-3">
                <span className="font-display text-2xl text-fg">{note.label}</span>
                <span className="mt-1 block text-sm text-muted">{note.line}</span>
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap gap-2">
          {(
            [
              ["board", "Board"],
              ["web", "Map"],
              ["world", "World"],
              ["library", "Library"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" onClick={() => open(id)} className="h-10 rounded-full border border-border px-4 text-sm text-fg">
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
