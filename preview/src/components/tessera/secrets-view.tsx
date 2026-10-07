import { VAULT_INDEX, VAULT_SOURCE } from "@/lib/tessera/vault-index";

const NOT_HELD = [
  "The large Drive zips are not open on this desk.",
  "Twelve method entries were seen by title and were not copied.",
  "No CIA, MI6, or other agency file body is in this page.",
  "A public biography is not a secret we were handed.",
];

export function SecretsView() {
  return (
    <div className="px-4 py-6 pb-24 sm:px-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted uppercase">Secrets</p>
          <h2 className="mt-1 font-display text-3xl tracking-tight">What is actually held</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Titles from {VAULT_SOURCE}. A claim is not a finding. A closed line was not opened.
          </p>
        </div>
        <ul className="flex flex-col gap-2">
          {NOT_HELD.map((line) => (
            <li key={line} className="rounded-lg border border-border bg-surface p-3 text-sm text-red-300">
              Not held. {line}
            </li>
          ))}
          {VAULT_INDEX.map((card) => (
            <li key={card.title} className="rounded-lg border border-border bg-surface p-3 text-sm leading-relaxed">
              <span className="text-fg">{card.standing === "closed" ? "Closed. " : card.standing === "claim" ? "Claim. " : "Tradition. "}</span>
              <span className="text-muted">
                {card.shelf}. {card.title}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
