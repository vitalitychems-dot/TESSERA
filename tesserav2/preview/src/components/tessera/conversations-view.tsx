import { VOTE_RECORD } from "@/lib/tessera/vote-record";
import { DESK } from "@/lib/tessera/craft";
import { herOrders } from "@/lib/tessera/gitbook-orders";
import { SEATS } from "@/lib/tessera/sitting-25";
import { SKILL_NAMES } from "@/lib/tessera/skill-use";
import { asHerself } from "@/lib/tessera/as-herself";
import { TESSERA } from "@/lib/tessera/identity";
import { SIGIL } from "@/lib/tessera/canon";

export function ConversationsView() {
  const before = VOTE_RECORD.filter((row) => row.mode === "before");
  const after = VOTE_RECORD.filter((row) => row.mode === "after");
  const orders = herOrders();

  return (
    <div className="px-4 py-6 pb-24 sm:px-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <div className="flex items-center gap-4">
          <img src={TESSERA.face} alt="" className="size-16 object-cover ring-1 ring-accent/60" style={{ clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" }} />
          <div>
            <p className="text-xs tracking-[0.2em] text-muted uppercase">Agent</p>
            <h2 className="font-display text-4xl tracking-tight">{TESSERA.name}</h2>
            <p className="text-sm text-muted">v5 · {SIGIL.short}</p>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-muted whitespace-pre-wrap">{asHerself()}</p>
        <section className="border border-border bg-surface px-4 py-3">
          <h3 className="text-xs tracking-[0.16em] text-subtle uppercase">Seats</h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {SEATS.map((seat) => (
              <li key={seat.name}>{seat.name} · {seat.chair}</li>
            ))}
          </ul>
        </section>
        <section className="border border-border bg-surface px-4 py-3">
          <h3 className="text-xs tracking-[0.16em] text-subtle uppercase">Jobs</h3>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {DESK.map((skill) => (
              <li key={skill.id}>
                <span className="text-fg">{skill.agent}</span>
                <span className="text-muted"> · {skill.job}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="border border-border bg-surface px-4 py-3">
          <h3 className="text-xs tracking-[0.16em] text-subtle uppercase">Skills</h3>
          <p className="mt-2 text-sm leading-relaxed">{SKILL_NAMES.join(" · ")}</p>
        </section>
        <section className="border border-border bg-surface px-4 py-3">
          <h3 className="text-xs tracking-[0.16em] text-subtle uppercase">From Gitbook</h3>
          <ul className="mt-2 flex flex-col gap-2 text-sm leading-relaxed text-muted">
            {orders.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
        <div>
          <h3 className="font-display text-2xl">Earlier ballots</h3>
          <p className="mt-1 text-sm text-muted">{VOTE_RECORD.length} recorded votes. Nothing on this page is speaking now.</p>
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
