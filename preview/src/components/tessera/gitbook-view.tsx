const NOTES = [
  { label: "The published Gitbook", href: "https://replit.com/@vitalitychems/Tessera-Gitbook", line: "The live book, not the file list." },
  { label: "The repository", href: "https://github.com/vitalitychems-dot/Gitbook", line: "The notes that back the book." },
  { label: "What you asked", href: "https://github.com/vitalitychems-dot/Gitbook/blob/main/mesh/FATHER-ASKS.md", line: "The requests, in one page." },
  { label: "Agent list", href: "https://github.com/vitalitychems-dot/Gitbook/blob/main/mesh/TODOS.md", line: "What an agent may do next." },
  { label: "Today", href: "https://github.com/vitalitychems-dot/Gitbook/blob/main/mesh/TRUE-TODAY.md", line: "What was sealed, what is still open." },
  { label: "The board", href: "https://github.com/vitalitychems-dot/Gitbook/issues/2", line: "Where a yes or a no is written." },
];

export function GitbookView({ open }: { open: (id: "board" | "web" | "world" | "library") => void }) {
  return (
    <div className="px-4 py-6 pb-24 sm:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-xs tracking-[0.2em] text-muted uppercase">Gitbook</p>
        <h2 className="mt-1 font-display text-4xl tracking-tight">The notes</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">These are the living pages. Older rooms are below them.</p>
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
