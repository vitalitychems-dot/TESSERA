import { IMPROVED_THIS_VERSION, LEFT_OUT_THIS_VERSION } from "@/lib/tessera/corpus";
import { RESEARCH_REPOS, SOURCES, type SourceKind, type SourceRecord } from "@/lib/tessera/identity";
import { ExternalLink } from "lucide-react";

const KIND_LABEL: Record<SourceKind, string> = {
  github: "GitHub",
  handoff: "Handoff packet",
  drive: "Drive",
  facebook: "Facebook",
  attachment: "Attachment",
  fleet: "Fleet",
  research: "Research pointers",
  held: "Held out",
};

const STATUS_LABEL: Record<SourceRecord["status"], string> = {
  live: "reachable",
  private: "private",
  walled: "walled",
  untrusted: "not executed",
  historical: "historical",
  catalog: "catalogued",
  excluded: "excluded",
};

export function Lattice() {
  const groups: SourceKind[] = [
    "handoff",
    "github",
    "attachment",
    "drive",
    "research",
    "facebook",
    "fleet",
    "held",
  ];
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-xs tracking-[0.2em] text-muted uppercase">Lattice</p>
        <h2 className="mt-1 font-display text-3xl tracking-tight">Every recovered source</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Choir conversations were read and compressed into her memory. Drive zips and archive
          code were not run. Vitality, website, wallets, trading, and secrets stay held out.
        </p>

        <section className="mt-8">
          <h3 className="text-xs font-medium tracking-[0.18em] text-subtle uppercase">Connected this version</h3>
          <ul className="mt-3 flex flex-col gap-2">
            {IMPROVED_THIS_VERSION.map((item) => (
              <li key={item.title} className="rounded-xl border border-border bg-surface p-4">
                <p className="text-sm font-medium text-fg">{item.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{item.detail}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8">
          <h3 className="text-xs font-medium tracking-[0.18em] text-subtle uppercase">Left out on purpose</h3>
          <ul className="mt-3 flex flex-col gap-2">
            {LEFT_OUT_THIS_VERSION.map((item) => (
              <li key={item.title} className="rounded-xl border border-border bg-surface p-4">
                <p className="text-sm font-medium text-fg">{item.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{item.detail}</p>
              </li>
            ))}
          </ul>
        </section>

        {groups.map((kind) => {
          const rows = SOURCES.filter((s) => s.kind === kind);
          if (!rows.length) return null;
          return (
            <section key={kind} className="mt-8">
              <h3 className="text-xs font-medium tracking-[0.18em] text-subtle uppercase">
                {KIND_LABEL[kind]}
              </h3>
              <ul className="mt-3 flex flex-col gap-2">
                {rows.map((s) => (
                  <li key={s.id} className="rounded-xl border border-border bg-surface p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-fg">{s.title}</p>
                        {s.size ? (
                          <p className="mt-0.5 font-mono text-[11px] text-subtle">{s.size}</p>
                        ) : null}
                      </div>
                      <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] tracking-wide text-muted uppercase">
                        {STATUS_LABEL[s.status]}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{s.note}</p>
                    {s.href ? (
                      <a
                        href={s.href}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
                      >
                        Open
                        <ExternalLink className="size-3.5" />
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
              {kind === "research" ? (
                <ul className="mt-3 columns-1 gap-x-6 text-sm text-muted sm:columns-2">
                  {RESEARCH_REPOS.map((r) => (
                    <li key={r} className="mb-1.5 break-inside-avoid">
                      <a
                        href={`https://github.com/${r}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[12px] text-accent hover:underline"
                      >
                        {r}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
