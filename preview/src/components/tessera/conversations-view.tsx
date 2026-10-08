import { VOTE_RECORD } from "@/lib/tessera/vote-record";

export function ConversationsView() {
  const before = VOTE_RECORD.filter((row) => row.mode === "before");
  const after = VOTE_RECORD.filter((row) => row.mode === "after");

  return (
    <div className="px-4 py-6 pb-24 sm:px-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted uppercase">Agents</p>
          <h2 className="mt-1 font-display text-4xl tracking-tight">The recorded votes</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {VOTE_RECORD.length} ballots from two sittings already held. Nothing on this page is speaking now.
          </p>
        </div>
        {[{ label: "Before", rows: before }, { label: "After", rows: after }].map((group) => (
          <section key={group.label}>
            <h3 className="font-display text-2xl">{group.label}</h3>
            <ul className="mt-2 flex flex-col gap-2">
              {group.rows.map((row) => (
                <li key={`${row.mode}-${row.id}`} className="border border-border bg-surface px-3 py-2">
                  <p className="text-sm text-fg">
                    {row.name} · {row.vote}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{row.text.replace(/^VOTE: [AB]\n/, "")}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
