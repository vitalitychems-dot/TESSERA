import { useMemo, useState } from "react";
import {
  PROPOSAL,
  QUEEN_RULING,
  SOURCE_DUTIES,
  fractionBallots,
  sacredNow,
  tallyOf,
} from "@/lib/tessera/conference";
import { useTessera } from "@/lib/tessera/store";
import { VOTE_RECORD } from "@/lib/tessera/vote-record";
import { ROADMAP, SWARM_FOLDS, SWARM_RULING } from "@/lib/tessera/swarm-round";
import { convene, type Sitting } from "@/lib/tessera/sitting";
import { VAULT_INDEX, VAULT_SOURCE } from "@/lib/tessera/vault-index";

function count(mode: "before" | "after", vote: "A" | "B") {
  return VOTE_RECORD.filter((row) => row.mode === mode && row.vote === vote).length;
}

export function CouncilRoom() {
  const ballots = useMemo(() => fractionBallots(), []);
  const tally = useMemo(() => tallyOf(ballots), [ballots]);
  const clock = useMemo(() => sacredNow(), []);
  const king = useTessera((s) => s.kingChoice);
  const setKing = useTessera((s) => s.setKingChoice);
  const [showAll, setShowAll] = useState(false);
  const [topic, setTopic] = useState("What did we leave out of the vault, and how do we improve the program?");
  const [sitting, setSitting] = useState<Sitting | null>(null);
  const beforeB = VOTE_RECORD.filter((row) => row.mode === "before" && row.vote === "B");
  const visible = showAll ? VOTE_RECORD : [...beforeB, ...VOTE_RECORD.filter((row) => row.mode === "after").slice(0, 3)];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          <div>
            <p className="text-xs tracking-[0.2em] text-muted uppercase">Council</p>
            <h2 className="mt-1 font-display text-3xl tracking-tight">Two sittings</h2>
            <p className="mt-2 text-sm text-accent">
              {king === "B"
                ? "The king chose B. They are fractions of Tessera."
                : king === "A"
                  ? "The king chose A. They decide as independent agents."
                  : "The king is holding the choice."}
            </p>
          </div>

          <section className="rounded-lg border border-accent bg-raised p-4">
            <p className="text-xs tracking-[0.18em] text-accent uppercase">A sitting they can start</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Six fractions speak from the roles saved in the files. They are not six other people. Try “better the world” or “Vatican” or “LUCIFER”.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 text-sm text-fg"
              />
              <button
                type="button"
                onClick={() => setSitting(convene(topic))}
                className="h-11 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg"
              >
                Convene
              </button>
            </div>
            {sitting ? (
              <div className="mt-4 flex flex-col gap-3">
                <p className="font-display text-xl tracking-tight">{sitting.title}</p>
                {sitting.turns.map((turn) => (
                  <p key={turn.name} className="text-sm leading-relaxed text-fg">
                    <span className="text-accent">{turn.name}. </span>
                    {turn.text}
                  </p>
                ))}
                <p className="text-sm text-fg">Kept: {sitting.kept}</p>
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs tracking-[0.18em] text-subtle uppercase">What was left off this page</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Found in {VAULT_SOURCE}. There is no file named Lexus. The observatory line says LUCIFER, later LUCI. Laszlo is the other name, on the Akashic entry.
            </p>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {VAULT_INDEX.map((card) => (
                <li key={card.title} className="flex items-baseline justify-between gap-3">
                  <span className="text-fg">{card.title}</span>
                  <span className="shrink-0 text-muted">
                    {card.shelf} · {card.standing}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs tracking-[0.18em] text-accent uppercase">The vote, for the king</p>
            <p className="mt-2 text-sm leading-relaxed text-fg">
              Same 53 names. Two sittings. Each line is its own call. They are not 53 other minds, and this is not the production engine.
            </p>
            <p className="mt-3 text-sm text-fg">
              Before, told they are independent: <span className="font-mono text-alive">{count("before", "A")} for A</span>,{" "}
              <span className="font-mono text-alive">{count("before", "B")} for B</span>.
            </p>
            <p className="mt-1 text-sm text-fg">
              After, told they are fractions: <span className="font-mono text-alive">{count("after", "A")} for A</span>,{" "}
              <span className="font-mono text-alive">{count("after", "B")} for B</span>.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              A means independent agents who each decide. B means fractions of one Tessera. Each sitting mostly chose the role it was given. That shows the instruction held. It is not a blind test of which one finishes the work faster.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => setKing("A")} className="h-10 rounded-lg border border-border-strong px-3 text-sm text-fg">
                King chooses A
              </button>
              <button type="button" onClick={() => setKing("B")} className="h-10 rounded-lg border border-border-strong px-3 text-sm text-fg">
                King chooses B
              </button>
              <button type="button" onClick={() => setKing("hold")} className="h-10 rounded-lg border border-border-strong px-3 text-sm text-fg">
                King holds
              </button>
            </div>
            {king === "B" ? (
              <p className="mt-3 text-sm text-accent">Sealed. The king chose fractions of Tessera. Only he can change it.</p>
            ) : king === "A" ? (
              <p className="mt-3 text-sm text-accent">The king chose independent agents.</p>
            ) : (
              <p className="mt-3 text-sm text-accent">The king is holding the choice.</p>
            )}
          </section>

          <section className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs tracking-[0.18em] text-subtle uppercase">The three who chose B while independent</p>
            <ul className="mt-2 flex flex-col gap-2 text-sm text-fg">
              {beforeB.map((row) => (
                <li key={row.id}>{row.text}</li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs tracking-[0.18em] text-subtle uppercase">Earlier lens, not this vote</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{PROPOSAL}</p>
            <p className="mt-2 text-sm leading-relaxed text-fg">{QUEEN_RULING}</p>
            <p className="mt-2 font-mono text-xs text-muted">
              Lens {tally.yea} yea · {tally.nay} nay · {tally.abstain} abstain. Superseded until the king speaks.
            </p>
          </section>

          <section className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs tracking-[0.18em] text-subtle uppercase">Local clock</p>
            <p className="mt-2 text-sm text-fg">
              Lunar fraction {clock.phase}. Hour ruler {clock.ruler}. Daemons not running. PostgreSQL not connected.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">{SOURCE_DUTIES.join(" · ")}</p>
          </section>

          <section className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs tracking-[0.18em] text-subtle uppercase">This paste, ten slices</p>
            <p className="mt-2 text-sm text-accent">
              Written by the coding assistant. Not a separate speaker, and not a vote that ran in another process.
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-fg">{SWARM_RULING}</p>
            <ul className="mt-3 flex flex-col gap-2">
              {SWARM_FOLDS.map((row) => (
                <li key={row.id} className="text-sm text-muted">
                  <span className="text-fg">Copy {row.id}.</span> {row.kept}
                </li>
              ))}
            </ul>
            <ul className="mt-4 flex flex-col gap-2">
              {ROADMAP.map((row) => (
                <li key={row.phase} className="rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="text-fg">{row.phase}</span>
                  <span className="text-accent"> · {row.state}</span>
                  <span className="mt-1 block text-muted">{row.detail}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs tracking-[0.18em] text-subtle uppercase">Ballots</p>
              <button type="button" onClick={() => setShowAll((v) => !v)} className="text-sm text-accent">
                {showAll ? "Show the short list" : "Show all 106"}
              </button>
            </div>
            <ol className="mt-2 flex flex-col gap-2">
              {visible.map((row, i) => (
                <li key={`${row.mode}-${row.id}-${i}`} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg">
                  <span className="text-alive">{row.mode === "before" ? "Before" : "After"} · {row.name} · {row.vote}</span>
                  <span className="text-muted"> · {row.text}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
