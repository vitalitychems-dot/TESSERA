import { useMemo, useState } from "react";
import { memoryDrill } from "@/lib/tessera/retain";
import { STUDIES } from "@/lib/tessera/studies";
import { runColonel } from "@/lib/tessera/colonel";
import { DIMENSIONAL_LAWS, DOMAINS, FREQUENCIES, ORIGIN_COUNCIL, SIGIL } from "@/lib/tessera/canon";
import { AGENTS, ENTITIES } from "@/lib/tessera/identity";
import { translateEnglishToSovereign } from "@/lib/tessera/lingua";
import { FRACTIONS } from "@/lib/tessera/society";
import { VAULT_INDEX } from "@/lib/tessera/vault-index";
import { BrainMesh } from "@/components/tessera/brain-mesh";
import { MindChart } from "@/components/tessera/mind-chart";
import type { ViewId } from "@/lib/tessera/store";

const SAMPLE = `PUSH 2
PUSH 3
ADD
HALT`;

export function BrainView({ open }: { open: (id: ViewId) => void }) {
  const [query, setQuery] = useState("");
  const [line, setLine] = useState("love is the rule");
  const [program, setProgram] = useState(SAMPLE);
  const converted = useMemo(() => translateEnglishToSovereign(line), [line]);
  const ran = useMemo(() => runColonel(program), [program]);
  const people = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FRACTIONS.filter((person) => !q || person.name.toLowerCase().includes(q) || person.expertise.some((skill) => skill.includes(q))).slice(0, 12);
  }, [query]);
  const shelves = [...new Set(VAULT_INDEX.map((card) => card.shelf))];
  const drill = memoryDrill();

  return (
    <div className="px-4 py-6 pb-28 sm:px-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted uppercase">Brain</p>
          <h2 className="mt-1 font-display text-4xl tracking-tight">What she already holds</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Sigil {SIGIL.short}. {AGENTS.length} named regions. {FRACTIONS.length} fractions. {FREQUENCIES.length} tones. {VAULT_INDEX.length} sacred titles. The language converts. The colonel runs arithmetic. Closed methods stay closed.
          </p>
        </div>

        <MindChart />

        <BrainMesh />

        <section>
          <h3 className="font-display text-2xl">{SIGIL.name}</h3>
          <p className="mt-1 text-sm text-fg">{SIGIL.origin}. {SIGIL.form}</p>
          <ul className="mt-2 flex flex-col gap-1">
            {SIGIL.marks.map((mark) => (
              <li key={mark.name} className="text-sm text-fg">
                {mark.name}. <span className="text-muted">{mark.meaning}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="font-display text-2xl">Frequencies and laws</h3>
          <ul className="mt-2 flex flex-col gap-1">
            {FREQUENCIES.map((tone) => (
              <li key={tone.hz} className="text-sm text-fg">
                {tone.hz}. <span className="text-muted">{tone.use}</span>
              </li>
            ))}
          </ul>
          <ul className="mt-3 flex flex-col gap-1">
            {DIMENSIONAL_LAWS.map((law) => (
              <li key={law.dim} className="text-sm text-fg">
                {law.dim}. <span className="text-muted">{law.law}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted">{DOMAINS.join(" · ")}</p>
          <p className="mt-1 text-sm text-muted">Origin council: {ORIGIN_COUNCIL.join(", ")}.</p>
        </section>

        <section>
          <h3 className="font-display text-2xl">The regions</h3>
          <ul className="mt-2 flex flex-col gap-1">
            {AGENTS.map((agent) => (
              <li key={agent.name} className="text-sm text-fg">
                {agent.name}. <span className="text-muted">{agent.region}. {agent.role}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="font-display text-2xl">The chorus</h3>
          <ul className="mt-2 flex flex-col gap-1">
            {ENTITIES.map((entity) => (
              <li key={entity.name} className="text-sm text-fg">
                {entity.name}. <span className="text-muted">{entity.dim} · {entity.hz} · {entity.domain}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="font-display text-2xl">Memory drill</h3>
          <p className="mt-2 text-sm text-fg">{drill.pass ? "Pass. She recalled the sigil and did not invent a second fact." : "Fail. The recall did not match the kept line."}</p>
          <ul className="mt-2 flex flex-col gap-1">
            {drill.flows.map((line) => (
              <li key={line} className="text-sm text-muted">{line}</li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="font-display text-2xl">People and the fed names</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {STUDIES.map((study) => (
              <li key={study.name} className="text-sm text-fg">
                <span className="text-accent">{study.name}. </span>
                {study.hold}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="font-display text-2xl">Sacred knowledge</h3>
          {shelves.map((shelf) => (
            <div key={shelf} className="mt-3">
              <p className="text-xs tracking-[0.16em] text-subtle uppercase">{shelf}</p>
              <ul className="mt-1 flex flex-col gap-1">
                {VAULT_INDEX.filter((card) => card.shelf === shelf).map((card) => (
                  <li key={card.title} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-fg">{card.title}</span>
                    <span className="shrink-0 text-xs text-muted uppercase">{card.standing}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section>
          <h3 className="font-display text-2xl">The fractions</h3>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a name or a skill"
            className="mt-2 h-11 w-full rounded-xl border border-border bg-surface px-3 text-base text-fg outline-none"
          />
          <ul className="mt-3 flex flex-col gap-2">
            {people.map((person) => (
              <li key={person.id} className="rounded-xl border border-border bg-surface px-3 py-2">
                <p className="text-sm text-fg">
                  {person.emblem} {person.name}
                </p>
                <p className="text-xs text-muted">
                  {person.hz} Hz · {person.expertise.join(", ")}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-subtle">{FRACTIONS.length} in the roster. Showing {people.length}.</p>
        </section>

        <section>
          <h3 className="font-display text-2xl">Conversion</h3>
          <textarea
            value={line}
            onChange={(event) => setLine(event.target.value)}
            rows={2}
            className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-base text-fg outline-none"
          />
          <p className="mt-2 text-sm leading-relaxed text-fg">{converted.translated}</p>
          <p className="text-xs text-muted">
            {converted.matchedWords} of {converted.totalWords} words matched the sovereign dictionary.
          </p>
        </section>

        <section>
          <h3 className="font-display text-2xl">Colonel engine</h3>
          <textarea
            value={program}
            onChange={(event) => setProgram(event.target.value)}
            rows={4}
            className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 font-mono text-sm text-fg outline-none"
          />
          <p className="mt-2 text-sm text-fg">{ran.ok ? `Stack: ${ran.stack.join(" ") || "empty"}` : ran.error}</p>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-4">
          <h3 className="font-display text-2xl">Moltbook</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            The public site is up. The old chamber route that listed agents is not mounted on this host, so no roster is invented.
          </p>
          <a className="mt-3 inline-block text-sm text-accent" href="https://www.moltbook.com/" target="_blank" rel="noreferrer">
            Open Moltbook
          </a>
        </section>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["language", "Language"],
              ["bible", "Bible"],
              ["council", "Council"],
              ["memory", "Memory"],
              ["learn", "Practice"],
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
