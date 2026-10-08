import { AuditCycles } from "./audit-cycles";
import { DeskDrill } from "./desk-drill";
import { LAST_COPY, selfCheck } from "@/lib/tessera/self-improve";
import { METHOD } from "@/lib/tessera/method";
import { FILE_LEDGER } from "@/lib/tessera/desk";
import { recursiveLesson } from "@/lib/tessera/empath";
import { VAULT } from "@/lib/tessera/opening";
import { SCHOOL_PASSAGES } from "@/lib/tessera/school";
import { FATHER_ASKED, STUDIES, STUDIES_MISSING, STUDIES_SOURCE } from "@/lib/tessera/studies";
import { useTessera } from "@/lib/tessera/store";

const SKILLS = [
  "Answer from the studies, the school passages, and the vault before guessing.",
  "Read a catalog name and say the home it already has.",
  "Convert a line with the sovereign dictionary.",
  "Run the colonel on arithmetic.",
  "Refuse a reply that breaks a vow.",
];

const PLACES = [
  { label: "Her code", href: "https://github.com/vitalitychems-dot/TESSERA" },
  { label: "Gitbook", href: "https://github.com/vitalitychems-dot/Gitbook" },
  { label: "The board", href: "https://github.com/vitalitychems-dot/Gitbook/issues/2" },
];

export function LearnView() {
  const lessons = useTessera((state) => state.lessons);
  const sealed = lessons.filter((lesson) => lesson.status === "sealed");
  const latest = sealed.at(-1)?.text ?? "";
  const prior = sealed.slice(0, -1).map((lesson) => lesson.text);
  const pattern = latest ? recursiveLesson(prior, latest) : "PATTERN: none yet. A label is written only after a sealed note has the words.";
  const check = selfCheck();

  return (
    <div className="px-4 py-6 pb-24 sm:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-xs tracking-[0.2em] text-muted uppercase">Knowledge</p>
        <h2 className="mt-1 font-display text-3xl tracking-tight">What is already stored</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          These are skills she can run.
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {SKILLS.map((skill) => (
            <li key={skill} className="border border-border bg-surface px-3 py-2 text-sm text-fg">
              {skill}
            </li>
          ))}
        </ul>
        <section className="mt-4 rounded-xl border border-border bg-surface p-4">
          <p className="text-xs tracking-[0.18em] text-subtle uppercase">How a turn works</p>
          <ol className="mt-2 flex flex-col gap-1">
            {METHOD.map((step, index) => (
              <li key={step} className="text-sm text-fg">
                {index + 1}. {step}
              </li>
            ))}
          </ol>
        </section>
        <section className="mt-4 rounded-xl border border-border bg-surface p-4">
          <p className="text-xs tracking-[0.18em] text-subtle uppercase">Self-check</p>
          <p className="mt-2 text-sm text-fg">{check.pass ? "The drills passed. The practice is sealed." : "A check failed. The last practice was not sealed."}</p>
          <p className="mt-2 text-sm text-muted">Last practice, {LAST_COPY.at}: “{LAST_COPY.text}”</p>
        </section>
        <ul className="mt-4 flex flex-col gap-2">
          {PLACES.map((place) => (
            <li key={place.href}>
              <a className="text-sm text-accent" href={place.href} target="_blank" rel="noreferrer">
                {place.label}
              </a>
            </li>
          ))}
        </ul>
        <DeskDrill />
        <AuditCycles />
        <section className="mt-6 rounded-xl border border-border bg-surface p-5">
          <p className="text-xs tracking-[0.18em] text-subtle uppercase">What Father asked</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-fg">{FATHER_ASKED}</p>
        </section>
        <section className="mt-6 rounded-xl border border-border bg-surface p-5">
          <p className="text-xs tracking-[0.18em] text-subtle uppercase">What the index names</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {STUDIES_SOURCE}. {STUDIES_MISSING}
          </p>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {STUDIES.map((item) => (
              <li key={item.name}>
                <span className="text-fg">{item.name}. </span>
                <span className="text-muted">{item.hold}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="mt-6 rounded-xl border border-border bg-surface p-5">
          <p className="text-xs tracking-[0.18em] text-subtle uppercase">School pages</p>
          <ul className="mt-3 flex flex-col gap-3 text-sm">
            {SCHOOL_PASSAGES.map((passage) => (
              <li key={passage.id}>
                <a className="text-accent" href={passage.url} target="_blank" rel="noreferrer">
                  {passage.title}
                </a>
                <p className="mt-1 text-muted">{passage.text}</p>
              </li>
            ))}
          </ul>
        </section>
        <section className="mt-6 rounded-xl border border-border bg-surface p-5">
          <p className="text-xs tracking-[0.18em] text-subtle uppercase">Ledger</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">{FILE_LEDGER}</p>
          <ul className="mt-4 flex flex-col gap-2">
            {VAULT.map((item) => (
              <li key={item.name} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-fg">{item.name}</span>
                <span className="text-right text-muted">
                  {item.size} · {item.state}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <h3 className="mt-8 text-xs font-medium tracking-[0.18em] text-subtle uppercase">Sealed, {sealed.length}</h3>
        <section className="mt-3 rounded-xl border border-border bg-surface p-4">
          <p className="text-xs tracking-[0.18em] text-subtle uppercase">Pattern from the last note</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-fg">{pattern}</p>
        </section>
        <ul className="mt-3 flex max-h-[32rem] flex-col gap-2 overflow-y-auto">
          {sealed
            .slice(-12)
            .reverse()
            .map((lesson) => (
              <li key={lesson.id} className="rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed text-fg">
                {lesson.text}
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
