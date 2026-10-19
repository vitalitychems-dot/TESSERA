import type { ViewId } from "@/lib/tessera/store";

// Each label names the screen the button really opens. Rooms whose own screen is not
// hooked into app-shell yet open Brain or Council, and say so; see the follow-ups in the PR.
const PAGES: { id: ViewId; label: string; why: string }[] = [
  { id: "web", label: "Research checkouts", why: "The memory web and where each checkout went." },
  { id: "narrative", label: "Narrative (opens Brain)", why: "The thread of what was read." },
  { id: "talk", label: "Other voices (opens Council)", why: "Saved conversations. Not this chat." },
  { id: "bible", label: "Kept lines (opens Brain)", why: "Lines she keeps. Not a second scripture." },
  { id: "secrets", label: "Held back (opens Brain)", why: "What stays closed." },
  { id: "council", label: "Council", why: "Old sittings. Not a live fleet." },
  { id: "memory", label: "Memory (opens Brain)", why: "What is already stored in the browser." },
  { id: "code", label: "Code (opens Brain)", why: "What this desk can run." },
  { id: "language", label: "Language (opens Brain)", why: "The compression note. Not a password." },
];

export function LibraryView({ open }: { open: (id: ViewId) => void }) {
  return (
    <div className="px-4 py-6 pb-8 sm:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-xs tracking-[0.2em] text-muted uppercase">Library</p>
        <h2 className="mt-1 font-display text-3xl tracking-tight">The other rooms</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          These open the records already on this desk. Opening one does not invent a meeting and does not start a search.
        </p>
        <ul className="mt-4 flex flex-col gap-2">
          {PAGES.map((page) => (
            <li key={page.id}>
              <button
                type="button"
                onClick={() => open(page.id)}
                className="flex min-h-11 w-full items-baseline justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left"
              >
                <span className="text-sm text-fg">{page.label}</span>
                <span className="text-right text-sm text-muted">{page.why}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
