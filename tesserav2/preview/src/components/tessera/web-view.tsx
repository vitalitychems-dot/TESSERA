import { useMemo, useState } from "react";
import { CHECKOUT_LESSON, FLOWS, HOME_LABEL, PASS_DATE, countByHome, filterCatalog } from "@/lib/tessera/memory-web";
import { joinAsk } from "@/lib/tessera/join-web";
import type { CatalogHome } from "@/lib/tessera/catalog-pass";

const FILTERS: { id: CatalogHome | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "live", label: "Live" },
  { id: "gitbook", label: "Gitbook" },
  { id: "card", label: "Cards" },
  { id: "held", label: "Held" },
  { id: "tool", label: "Tools" },
  { id: "gap", label: "Gaps" },
  { id: "not-a-repo", label: "Not repos" },
];

export function WebView() {
  const counts = useMemo(() => countByHome(), []);
  const [query, setQuery] = useState("");
  const [home, setHome] = useState<CatalogHome | "all">("all");
  const rows = useMemo(
    () => filterCatalog(query, home).filter((row) => row.home !== "vitality" && !/vitality/i.test(row.name)),
    [query, home],
  );
  const joined = useMemo(() => (query.trim() ? joinAsk(query) : null), [query]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 pb-24 sm:px-8">
      <p className="text-xs tracking-[0.2em] text-muted uppercase">Memory web</p>
      <h2 className="mt-1 font-display text-3xl tracking-tight">Where each thing went</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Opened {PASS_DATE}. {counts.total} names. {counts.present} repositories still exist. {counts.missing} names did not resolve. A search joins a name to the home it already has. A tool card, a held repo, and a gap stay unconnected.
      </p>
      {joined && joined.home !== "vitality" ? <p className="mt-3 text-sm leading-relaxed text-fg">{joined.line}</p> : null}

      <ol className="mt-6 flex flex-col gap-3">
        {FLOWS.map((flow, index) => (
          <li key={flow.id} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs tracking-[0.16em] text-subtle uppercase">Flow {index + 1}</p>
            <p className="mt-1 text-sm font-medium text-fg">{flow.intake}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{flow.rule}</p>
            <p className="mt-2 text-sm leading-relaxed text-fg">{flow.home}</p>
          </li>
        ))}
      </ol>

      <section className="mt-6 rounded-xl border border-border p-4">
        <h3 className="text-sm font-medium text-fg">Research checkouts</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{CHECKOUT_LESSON}</p>
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setHome(item.id)}
            className={
              home === item.id
                ? "min-h-11 rounded-full bg-accent px-3 py-2 text-sm text-accent-fg"
                : "min-h-11 rounded-full border border-border px-3 py-2 text-sm text-muted"
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      <label className="mt-4 block text-sm text-muted" htmlFor="web-search">
        Find a name
      </label>
      <input
        id="web-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="owner/repository"
        className="mt-2 min-h-11 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg"
      />
      <p className="mt-3 text-sm text-muted">
        Showing {rows.length} of {counts.total}
      </p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nothing in this web matches that name.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.name} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-fg">{row.name}</p>
                <p className="text-xs tracking-[0.14em] text-subtle uppercase">{HOME_LABEL[row.home]}</p>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">{row.note}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
